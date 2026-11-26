import { createHash, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logAudit } from '../../shared/audit.js';
import { decryptAbhaNumberAtRest } from '../abha/abha.crypto.js';
import { pushHealthInformation } from '../../integrations/abdm/dataPush.js';
import { KEY_PARAMETERS, openSession } from '../../integrations/abdm/fidelius.js';
import * as repo from './hip.repository.js';
import { callGateway } from './gateway.js';

function within(innerFrom, innerTo, outerFrom, outerTo) {
  return new Date(innerFrom) >= new Date(outerFrom) && new Date(innerTo) <= new Date(outerTo);
}

export function consentAllows(artefact, request, now = new Date()) {
  if (!artefact) return 'CONSENT_MISSING';
  if (artefact.status !== 'GRANTED') return 'CONSENT_NOT_GRANTED';
  if (artefact.revokedAt || artefact.status === 'REVOKED') return 'CONSENT_REVOKED';
  if (new Date(artefact.expiresAt) <= now) return 'CONSENT_EXPIRED';
  if (env.abdmHipId && artefact.hipId !== env.abdmHipId) return 'CONSENT_HIP_MISMATCH';
  const wanted = request.careContextRefs || [];
  const allowed = new Set(artefact.careContextRefs || []);
  if (wanted.some((ref) => !allowed.has(ref))) return 'CONSENT_CONTEXT_MISMATCH';
  if (!within(request.dateFrom, request.dateTo, artefact.dateFrom, artefact.dateTo)) {
    return 'CONSENT_DATE_MISMATCH';
  }
  const types = new Set(artefact.hiTypes || []);
  if ((request.hiTypes || []).some((type) => !types.has(type))) return 'CONSENT_HI_TYPE_MISMATCH';
  return null;
}

export async function storeConsent(body, correlationId) {
  const notification = body?.notification || {};
  const detail = notification.consentDetail || {};
  const consentId = notification.consentId || detail.consentId;
  const status = notification.status || 'GRANTED';
  const existing = consentId ? await repo.findConsentByExternalId(consentId) : null;
  const data = {
    role: 'HIP',
    externalArtefactId: consentId,
    patientRef: detail.patient?.id || 'unknown',
    hipId: detail.hip?.id || env.abdmHipId || 'unknown',
    hiTypes: detail.hiTypes || [],
    careContextRefs: (detail.careContexts || []).map((item) => item.careContextReference).filter(Boolean),
    dateFrom: new Date(detail.permission?.dateRange?.from || detail.createdAt || Date.now()),
    dateTo: new Date(detail.permission?.dateRange?.to || detail.permission?.dataEraseAt || Date.now()),
    expiresAt: new Date(detail.permission?.dataEraseAt || detail.permission?.dateRange?.to || Date.now()),
    status,
    revokedAt: status === 'REVOKED' ? new Date() : null,
  };
  const saved = existing
    ? await repo.updateConsent(existing.id, data)
    : await repo.createConsentArtefact(data);
  await callGateway({
    name: 'consentOnNotify',
    workflow: 'hip.consent-ack',
    correlationId,
    body: {
      acknowledgement: { status: 'OK', consentId },
      response: { requestId: correlationId },
    },
  });
  await logAudit({
    action: 'hip.share',
    resourceType: 'consentArtefact',
    resourceId: saved.id,
    outcome: status === 'GRANTED' ? 'success' : 'denied',
    correlationId,
    message: `Consent ${status} stored for ${data.patientRef}.`,
  });
  return saved;
}

export async function fulfilInformationRequest({ body, requestId, correlationId }) {
  const hiRequest = body?.hiRequest || body || {};
  const consentId = hiRequest.consent?.id;
  const artefact = consentId ? await repo.findConsentByExternalId(consentId) : null;
  const dateFrom = hiRequest.dateRange?.from;
  const dateTo = hiRequest.dateRange?.to;
  const keyMaterial = hiRequest.keyMaterial || {};
  const refs = (artefact?.careContextRefs || []).filter((ref) => {
    const requested = hiRequest.careContexts || body?.notification?.consentDetail?.careContexts;
    if (!Array.isArray(requested) || requested.length === 0) return true;
    return requested.some((item) => item.careContextReference === ref || item.referenceNumber === ref);
  });
  const denial = consentAllows(artefact, {
    careContextRefs: refs,
    dateFrom,
    dateTo,
    hiTypes: hiRequest.hiTypes || artefact?.hiTypes || [],
  });
  const infoRequest = await repo.createInformationRequest({
    role: 'HIP',
    consentArtefactId: artefact?.id || (await placeholderConsent(consentId)).id,
    externalTransactionId: hiRequest.transactionId || body?.transactionId || null,
    dataPushUrl: hiRequest.dataPushUrl || null,
    status: denial ? denial : 'ACKNOWLEDGED',
    keyExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  if (denial) {
    await logAudit({
      action: 'hip.share',
      resourceType: 'healthInformationRequest',
      resourceId: infoRequest.id,
      outcome: 'denied',
      correlationId,
      message: `Health information request refused: ${denial}.`,
    });
    return { denied: denial };
  }

  await callGateway({
    name: 'healthInformationOnRequest',
    workflow: 'hip.hi-ack',
    correlationId,
    body: {
      hiRequest: {
        transactionId: hiRequest.transactionId || body.transactionId,
        sessionStatus: 'ACKNOWLEDGED',
      },
      response: { requestId },
    },
  });

  const session = openSession({
    requesterPublicKey: keyMaterial.dhPublicKey?.keyValue,
    requesterNonce: keyMaterial.nonce,
    cryptoAlg: keyMaterial.cryptoAlg,
    curve: keyMaterial.curve,
  });
  const entries = [];
  for (const ref of refs) {
    const context = await findContext(ref);
    const record = context?.healthRecord;
    if (!record?.bundleEnc || record.validationStatus !== 'VALID') continue;
    if (!artefact.hiTypes.includes(record.hiType)) continue;
    const plaintext = decryptAbhaNumberAtRest(record.bundleEnc);
    const content = session.encrypt(plaintext);
    entries.push({
      content,
      media: 'application/fhir+json',
      // ABDM: checksum is the MD5 of the content before encryption (hiecm.callback.m2-on-data-notification).
      checksum: createHash('md5').update(plaintext).digest('hex'),
      careContextReference: ref,
    });
    await repo.createTransfer({
      healthInformationRequestId: infoRequest.id,
      careContextId: context.id,
      direction: 'PUSH',
      status: 'PUSHED',
      bytes: record.bundleBytes,
      mocked: false,
      correlationId,
    });
  }

  if (entries.length === 0) {
    await logAudit({
      action: 'hip.share',
      resourceType: 'healthInformationRequest',
      resourceId: infoRequest.id,
      outcome: 'denied',
      correlationId,
      message: 'Health information request had no record to push.',
    });
    return { denied: 'NO_RECORD' };
  }

  const push = await pushHealthInformation({
    url: hiRequest.dataPushUrl,
    body: {
      pageNumber: 1,
      pageCount: 1,
      transactionId: hiRequest.transactionId || body.transactionId,
      entries,
      keyMaterial: {
        cryptoAlg: 'ECDH',
        curve: 'curve25519',
        dhPublicKey: {
          expiry: infoRequest.keyExpiresAt.toISOString(),
          parameters: KEY_PARAMETERS,
          keyValue: session.publicKey,
        },
        nonce: session.nonce,
      },
    },
  });

  if (push.status !== 202) {
    await logAudit({
      action: 'hip.share',
      resourceType: 'healthInformationRequest',
      resourceId: infoRequest.id,
      outcome: 'failure',
      correlationId,
      message: 'Health information push was not accepted.',
    });
    return { pushed: entries.length, status: push.status };
  }

  await callGateway({
    name: 'healthInformationNotify',
    workflow: 'hip.hi-notify',
    correlationId,
    body: {
      notification: {
        consentId,
        transactionId: hiRequest.transactionId || body.transactionId,
        doneAt: new Date().toISOString(),
        notifier: { type: 'HIP', id: env.abdmHipId },
        statusNotification: {
          sessionStatus: 'TRANSFERRED',
          hipId: env.abdmHipId,
          statusResponses: entries.map((entry) => ({
            careContextReference: entry.careContextReference,
            hiStatus: 'DELIVERED',
            description: 'Data sent successfully',
          })),
        },
      },
    },
  });
  await logAudit({
    action: 'hip.share',
    resourceType: 'healthInformationRequest',
    resourceId: infoRequest.id,
    outcome: 'success',
    correlationId,
    message: 'Encrypted health records were pushed for a granted consent.',
  });
  return { pushed: entries.length, status: push.status };
}

async function findContext(referenceNumber) {
  return repo.findCareContextByReferenceLoose(referenceNumber);
}

async function placeholderConsent(consentId) {
  return repo.createConsentArtefact({
    role: 'HIP',
    externalArtefactId: consentId || randomUUID(),
    patientRef: 'unknown',
    hipId: env.abdmHipId || 'unknown',
    hiTypes: [],
    careContextRefs: [],
    dateFrom: new Date(),
    dateTo: new Date(),
    expiresAt: new Date(),
    status: 'REQUESTED',
  });
}
