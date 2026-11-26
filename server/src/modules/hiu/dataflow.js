import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { logger } from '../../shared/logger.js';
import { decryptAbhaNumberAtRest, encryptAbhaNumberAtRest } from '../abha/abha.crypto.js';
import { assertSupported, decryptFromPeer, generateKeyMaterial } from '../../integrations/abdm/fidelius.js';
import { validateBundle } from '../../integrations/abdm/fhir/bundle.js';
import { HI_TYPES } from '../../integrations/abdm/fhir/profiles.js';
import { callGateway, upstreamCode, upstreamMessage } from '../hip/gateway.js';
import * as repo from './hiu.repository.js';
import { DATA_PUSH_PATH } from './constants.js';
import { requireHiuId } from './consent.js';

export function dataPushUrl() {
  const base = env.abdmHiuDataPushBaseUrl;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}${DATA_PUSH_PATH}`;
}

/** Why an artefact cannot be used now, or null. Never a silent empty result. */
export function artefactRefusal(artefact, now = new Date()) {
  if (!artefact || artefact.role !== 'HIU') return { status: 404, code: 'ARTEFACT_NOT_FOUND', message: 'Consent artefact not found' };
  if (artefact.status === 'REVOKED' || artefact.revokedAt) {
    return { status: 410, code: 'CONSENT_REVOKED', message: 'The patient revoked this consent.', at: artefact.revokedAt };
  }
  if (artefact.status === 'EXPIRED' || (artefact.expiresAt && new Date(artefact.expiresAt) <= now)) {
    return { status: 410, code: 'CONSENT_EXPIRED', message: 'This consent has expired.', at: artefact.expiredAt || artefact.expiresAt };
  }
  if (artefact.status !== 'GRANTED') {
    return { status: 409, code: 'CONSENT_NOT_GRANTED', message: 'This consent is not granted.' };
  }
  return null;
}

function clamp(value, min, max) {
  const v = new Date(value).getTime();
  return new Date(Math.min(Math.max(v, new Date(min).getTime()), new Date(max).getTime()));
}

async function eventually(lookup, attempts = 5, delayMs = 200) {
  for (let i = 0; i < attempts; i += 1) {
    const found = await lookup();
    if (found) return found;
    if (i < attempts - 1) await new Promise((resolve) => { setTimeout(resolve, delayMs); });
  }
  return null;
}

export async function requestHealthInformation({
  artefactId, dateFrom, dateTo, auth, correlationId,
}) {
  const hiuId = requireHiuId();
  const artefact = await repo.findArtefact(artefactId);
  if (artefact?.consentRequest && artefact.consentRequest.facilityId !== auth.facilityId) {
    throw new AppError(404, 'ARTEFACT_NOT_FOUND', 'Consent artefact not found');
  }
  const refusal = artefactRefusal(artefact);
  if (refusal) throw new AppError(refusal.status === 410 ? 409 : refusal.status, refusal.code, refusal.message);
  if (!artefact.fetchedAt || !artefact.dateFrom || !artefact.dateTo) {
    throw new AppError(409, 'ARTEFACT_NOT_FETCHED', 'The consent artefact has not been fetched yet. Fetch it first.');
  }
  const pushUrl = dataPushUrl();
  if (!pushUrl || !pushUrl.startsWith('https://')) {
    throw new AppError(409, 'DATA_PUSH_URL_MISSING', 'ABDM_HIU_DATA_PUSH_BASE_URL (or ABDM_CALLBACK_BASE_URL) must be a public HTTPS URL');
  }

  const from = clamp(dateFrom || artefact.dateFrom, artefact.dateFrom, artefact.dateTo);
  const to = clamp(dateTo || artefact.dateTo, from, artefact.dateTo);
  const keyExpiresAt = new Date(Date.now() + env.hiuKeyTtlMinutes * 60 * 1000);
  const material = generateKeyMaterial({ expiresAt: keyExpiresAt });

  const { result } = await callGateway({
    name: 'hiuHealthInformationRequest',
    body: {
      hiRequest: {
        consent: { id: artefact.externalArtefactId },
        dateRange: { from: from.toISOString(), to: to.toISOString() },
        dataPushUrl: pushUrl,
        keyMaterial: material.keyMaterial,
      },
    },
    hiuId,
    workflow: 'hiu.hi-request',
    correlationId: artefact.consentRequestId || artefact.id,
    milestone: 'M3',
    throwOnFailure: false,
  });
  const failed = result.status < 200 || result.status >= 300;
  const saved = await repo.createInformationRequest({
    role: 'HIU',
    consentArtefactId: artefact.id,
    dataPushUrl: pushUrl,
    status: failed ? 'FAILED' : 'REQUESTED',
    keyExpiresAt,
    requestId: result.requestId,
    privateKeyEnc: failed ? null : encryptAbhaNumberAtRest(material.privateKeyPkcs8),
    nonce: material.nonce,
    dateFrom: from,
    dateTo: to,
    lastErrorCode: failed ? upstreamCode(result.body) : null,
    lastErrorMessage: failed ? (upstreamMessage(result.body) || `HTTP ${result.status}`) : null,
  });
  await logAudit({
    actorId: auth.userId,
    facilityId: auth.facilityId,
    action: 'hiu.hi.request',
    resourceType: 'healthInformationRequest',
    resourceId: saved.id,
    outcome: failed ? 'failure' : 'success',
    correlationId: correlationId || result.requestId,
    message: failed
      ? `Health information request was refused by ABDM (${saved.lastErrorCode || result.status}).`
      : 'Health information was requested under a granted consent.',
  });
  return {
    id: saved.id,
    status: saved.status,
    requestId: result.requestId,
    lastErrorCode: saved.lastErrorCode,
    lastErrorMessage: saved.lastErrorMessage,
  };
}

export async function onRequest(transaction, body) {
  const hir = await eventually(() => repo.findInformationRequestByRequestId(transaction.requestId));
  if (!hir) throw new AppError(404, 'HI_REQUEST_UNKNOWN', 'on-request answers no stored health information request');
  if (body?.error || !body?.hiRequest?.transactionId) {
    return repo.updateInformationRequest(hir.id, {
      status: 'FAILED',
      privateKeyEnc: null,
      lastErrorCode: upstreamCode(body),
      lastErrorMessage: upstreamMessage(body) || 'on-request carried no transaction id',
    });
  }
  return repo.updateInformationRequest(hir.id, {
    externalTransactionId: body.hiRequest.transactionId,
    sessionStatus: body.hiRequest.sessionStatus || null,
    status: 'ACKNOWLEDGED',
  });
}

/**
 * Guard for an inbound push to dataPushUrl (outside the gateway). Returns the
 * request it belongs to or throws; nothing is stored for an unknown push.
 */
export async function acceptPush(req) {
  const bearer = req.get('authorization') || '';
  if (!bearer.startsWith('Bearer ') || bearer.length < 8) {
    await logAudit({
      action: 'hiu.hi.receive',
      resourceType: 'dataPush',
      outcome: 'denied',
      correlationId: req.id,
      message: 'Data push rejected: bearer token missing.',
    });
    throw new AppError(401, 'PUSH_UNAUTHENTICATED', 'Data push bearer token is required');
  }
  const body = req.body || {};
  const transactionId = body.transactionId;
  const hir = transactionId ? await repo.findInformationRequestByTransaction(transactionId) : null;
  if (!hir || !['ACKNOWLEDGED', 'PARTIAL'].includes(hir.status)) {
    await logAudit({
      action: 'hiu.hi.receive',
      resourceType: 'dataPush',
      outcome: 'denied',
      correlationId: req.id,
      message: 'Data push dropped: it names no open health information request.',
    });
    throw new AppError(404, 'PUSH_UNKNOWN', 'Data push names no open health information request');
  }
  if (!hir.privateKeyEnc || (hir.keyExpiresAt && new Date(hir.keyExpiresAt) <= new Date())) {
    throw new AppError(410, 'PUSH_KEY_EXPIRED', 'The key for this transaction has expired');
  }
  const refusal = artefactRefusal(hir.consentArtefact);
  if (refusal) {
    await logAudit({
      action: 'hiu.hi.receive',
      resourceType: 'dataPush',
      outcome: 'denied',
      correlationId: req.id,
      message: `Data push dropped: ${refusal.code}.`,
    });
    throw new AppError(409, refusal.code, refusal.message);
  }
  const pageNumber = Number(body.pageNumber || 1);
  if (await repo.findTransferPage(hir.id, pageNumber)) {
    return { hir, duplicate: true };
  }
  return { hir, duplicate: false };
}

function detectHiType(bundle) {
  const composition = bundle?.entry?.[0]?.resource;
  const profiles = composition?.meta?.profile || bundle?.meta?.profile || [];
  for (const url of profiles) {
    const name = String(url).split('/').pop();
    if (HI_TYPES.includes(name)) return name;
  }
  return null;
}

/** Decrypt, checksum, validate and store one page. Never logs content or keys. */
export async function processPush(hir, body, correlationId) {
  const artefact = hir.consentArtefact;
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const keyMaterial = body.keyMaterial || {};
  const pageNumber = Number(body.pageNumber || 1);
  const pageCount = Number(body.pageCount || 1);
  const privateKey = decryptAbhaNumberAtRest(hir.privateKeyEnc);
  const granted = new Set(artefact.hiTypes || []);
  const results = [];

  let algOk = true;
  try {
    assertSupported(keyMaterial.cryptoAlg, keyMaterial.curve);
  } catch {
    algOk = false;
  }

  for (const entry of entries) {
    const ref = entry.careContextReference || 'unknown';
    let hiStatus = 'OK';
    let description = 'Data received successfully';
    let record = null;
    try {
      if (!algOk) throw new AppError(400, 'FIDELIUS_ALG_UNSUPPORTED', 'Unsupported key agreement');
      const clear = decryptFromPeer({
        content: entry.content,
        peerPublicKey: keyMaterial.dhPublicKey?.keyValue,
        peerNonce: keyMaterial.nonce,
        ownPrivateKey: privateKey,
        ownNonce: hir.nonce,
      });
      const text = clear.toString('utf8');
      const checksumOk = !entry.checksum
        || createHash('md5').update(text).digest('hex').toLowerCase() === String(entry.checksum).toLowerCase();
      const bundle = JSON.parse(text);
      const hiType = detectHiType(bundle) || ((artefact.hiTypes || []).length === 1 ? artefact.hiTypes[0] : null);
      const allowed = hiType && granted.has(hiType);
      const validation = validateBundle(bundle, hiType);
      if (!checksumOk) {
        hiStatus = 'ERRORED';
        description = 'Checksum mismatch';
      } else if (!allowed) {
        hiStatus = 'ERRORED';
        description = 'HI type not covered by the consent';
      }
      record = {
        hiType,
        bundleEnc: hiStatus === 'OK' ? encryptAbhaNumberAtRest(text) : null,
        checksumOk,
        validationStatus: validation.valid ? 'VALID' : 'INVALID',
        validationProblems: validation.problems,
        byteLength: Buffer.byteLength(text),
      };
    } catch (err) {
      hiStatus = 'ERRORED';
      description = err instanceof SyntaxError ? 'Decrypted content is not JSON' : 'Could not decrypt the entry';
      logger.warn({ component: 'hiu.dataflow', code: err.code || err.name }, 'push entry failed');
    }
    const transfer = await repo.createTransfer({
      healthInformationRequestId: hir.id,
      careContextReference: ref,
      hipId: artefact.hipId,
      pageNumber,
      direction: 'RECEIVE',
      status: hiStatus === 'OK' ? 'RECEIVED' : 'ERRORED',
      receiptStatus: description,
      receivedAt: new Date(),
      validatedAt: record ? new Date() : null,
      failureCode: hiStatus === 'OK' ? null : description,
      bytes: record?.byteLength ?? null,
      mocked: false,
      correlationId,
    });
    if (record) {
      await repo.createReceivedRecord({
        dataTransferId: transfer.id,
        consentArtefactId: artefact.id,
        patientId: artefact.consentRequest?.patientId || null,
        careContextReference: ref,
        ...record,
      });
    }
    results.push({ careContextReference: ref, hiStatus, description });
  }

  if (entries.length === 0) {
    await repo.createTransfer({
      healthInformationRequestId: hir.id,
      pageNumber,
      direction: 'RECEIVE',
      status: 'EMPTY',
      receiptStatus: 'Page carried no entries',
      receivedAt: new Date(),
      mocked: false,
      correlationId,
    });
  }

  const pagesReceived = (hir.pagesReceived || 0) + 1;
  const complete = pagesReceived >= pageCount;
  await repo.updateInformationRequest(hir.id, {
    pagesExpected: pageCount,
    pagesReceived,
    status: complete ? 'TRANSFERRED' : 'PARTIAL',
    ...(complete ? { privateKeyEnc: null } : {}),
  });
  await logAudit({
    action: 'hiu.hi.receive',
    resourceType: 'healthInformationRequest',
    resourceId: hir.id,
    outcome: results.every((item) => item.hiStatus === 'OK') ? 'success' : 'failure',
    correlationId,
    message: `Received page ${pageNumber} of ${pageCount} with ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`,
  });
  if (complete) await notifyReceipt(hir);
  return { results, complete };
}

export async function notifyReceipt(hir) {
  const artefact = hir.consentArtefact;
  const transfers = (await repo.listReceivedTransfers(hir.id)).filter((item) => item.careContextReference);
  const statusResponses = transfers.map((item) => ({
    careContextReference: item.careContextReference,
    hiStatus: item.status === 'RECEIVED' ? 'OK' : 'ERRORED',
    description: item.receiptStatus || '',
  }));
  const allOk = statusResponses.length > 0 && statusResponses.every((item) => item.hiStatus === 'OK');
  // [VERIFY] sessionStatus enum of m3_post_data_flow_v3_health_information_notify: TRANSFERRED or FAILED.
  const { result } = await callGateway({
    name: 'healthInformationNotify',
    body: {
      notification: {
        consentId: artefact.externalArtefactId,
        transactionId: hir.externalTransactionId,
        doneAt: new Date().toISOString(),
        notifier: { type: 'HIU', id: env.abdmHiuId },
        statusNotification: {
          sessionStatus: allOk ? 'TRANSFERRED' : 'FAILED',
          hipId: artefact.hipId,
          statusResponses,
        },
      },
    },
    workflow: 'hiu.hi-notify',
    correlationId: artefact.consentRequestId || artefact.id,
    milestone: 'M3',
    throwOnFailure: false,
  });
  await logAudit({
    action: 'hiu.hi.notify',
    resourceType: 'healthInformationRequest',
    resourceId: hir.id,
    outcome: result.status >= 200 && result.status < 300 ? 'success' : 'failure',
    correlationId: result.requestId,
    message: `Receipt notified to ABDM (${allOk ? 'TRANSFERRED' : 'FAILED'}).`,
  });
  return result;
}

export async function transferStatus({ id }) {
  const hir = await repo.findInformationRequest(id);
  if (!hir || hir.role !== 'HIU' || !hir.externalTransactionId) {
    throw new AppError(404, 'HI_REQUEST_NOT_FOUND', 'No acknowledged health information request');
  }
  const { result } = await callGateway({
    name: 'hiuHealthInformationStatus',
    pathParams: { 'transaction-id': hir.externalTransactionId },
    workflow: 'hiu.hi-status',
    correlationId: hir.consentArtefactId,
    milestone: 'M3',
  });
  return { httpStatus: result.status, body: result.body, requestId: result.requestId };
}
