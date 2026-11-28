import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { logger } from '../../shared/logger.js';
import { assertIdempotency, saveIdempotency } from '../abha/abha.repository.js';
import { callGateway, upstreamCode, upstreamMessage } from '../hip/gateway.js';
import * as repo from './hiu.repository.js';
import { fullAbhaAddress } from '../abha/abhaFlow.js';
import { ABHA_ADDRESS_RE, PURPOSES, TERMINAL_STATES } from './constants.js';

const WORKFLOW = {
  init: 'hiu.consent-init',
  status: 'hiu.consent-status',
  ack: 'hiu.consent-ack',
  fetch: 'hiu.consent-fetch',
};

export function requireHiuId() {
  if (!env.abdmHiuId) {
    throw new AppError(503, 'HIU_ID_MISSING', 'ABDM_HIU_ID is not configured. Consent requests are refused until bridge-services returns an HIU service id.');
  }
  return env.abdmHiuId;
}

/** Forward-only state rule: a terminal state never changes, GRANTED only ends. */
export function canMove(from, to) {
  if (!to || from === to) return false;
  if (TERMINAL_STATES.has(from)) return false;
  if (to === 'INIT_SENT') return false;
  if (from === 'GRANTED') return to === 'REVOKED' || to === 'EXPIRED';
  if (to === 'INIT_FAILED') return from === 'INIT_SENT';
  if (to === 'REQUESTED') return from === 'INIT_SENT';
  return true;
}

const STAMP = {
  GRANTED: 'grantedAt',
  DENIED: 'deniedAt',
  EXPIRED: 'expiredAt',
  REVOKED: 'revokedAt',
};

export async function moveRequest(request, to, extra = {}, now = new Date()) {
  if (!request || !canMove(request.status, to)) return request;
  const data = { status: to, statusChangedAt: now, ...extra };
  if (STAMP[to]) data[STAMP[to]] = now;
  return repo.updateConsentRequest(request.id, data);
}

/** Wait briefly for a row the caller writes right after the gateway's 202. */
async function eventually(lookup, attempts = 5, delayMs = 200) {
  for (let i = 0; i < attempts; i += 1) {
    const found = await lookup();
    if (found) return found;
    if (i < attempts - 1) await new Promise((resolve) => { setTimeout(resolve, delayMs); });
  }
  return null;
}

function iso(value) {
  return new Date(value).toISOString();
}

export function buildInitBody({
  abhaAddress, purposeCode, hiTypes, dateFrom, dateTo, dataEraseAt, accessMode, frequency,
  requesterName, requesterIdentifier, hiuId, refUri,
}) {
  return {
    consent: {
      purpose: { text: PURPOSES[purposeCode], code: purposeCode, refUri },
      patient: { id: abhaAddress },
      hip: null,
      hiu: { id: hiuId },
      careContexts: null,
      requester: { name: requesterName, identifier: requesterIdentifier },
      hiTypes,
      permission: {
        accessMode,
        dateRange: { from: iso(dateFrom), to: iso(dateTo) },
        dataEraseAt: iso(dataEraseAt),
        frequency,
      },
    },
  };
}

export async function raiseConsentRequest({
  input, auth, correlationId, idempotencyKey,
}) {
  const hiuId = requireHiuId();
  const route = 'POST /hiu/consent-requests';
  const idem = await assertIdempotency({
    key: idempotencyKey, userId: auth.userId, route, body: input,
  });
  if (idem?.existing?.responseRef) {
    const prior = await repo.findConsentRequest(idem.existing.responseRef);
    if (prior) return prior;
  }

  const patient = await repo.findPatient(input.patientId);
  if (!patient || patient.facilityId !== auth.facilityId) {
    throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  }
  const abhaAddress = fullAbhaAddress(patient.abhaIdentity?.abhaAddress, env.abdmCmId) || '';
  if (!ABHA_ADDRESS_RE.test(abhaAddress)) {
    throw new AppError(422, 'ABHA_ADDRESS_REQUIRED', 'The patient has no ABHA address ending @sbx or @abdm. Create or link one first.');
  }
  const facility = await repo.findFacility(auth.facilityId);
  const requesterName = env.abdmHiuName || facility?.name || 'CHIP HIU';
  // [VERIFY] requester.identifier values: the specification gives only sample values.
  const requesterIdentifier = {
    value: facility?.hfrId || hiuId,
    type: 'HFR',
    system: 'https://facility.abdm.gov.in',
  };
  const frequency = input.frequency || { unit: 'HOUR', value: 1, repeats: 0 };
  const refUri = env.abdmCallbackBaseUrl || 'https://facility.abdm.gov.in';
  const body = buildInitBody({
    abhaAddress,
    purposeCode: input.purposeCode,
    hiTypes: input.hiTypes,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    dataEraseAt: input.dataEraseAt,
    accessMode: input.accessMode,
    frequency,
    requesterName,
    requesterIdentifier,
    hiuId,
    refUri,
  });

  const id = randomUUID();
  const { result, transaction } = await callGateway({
    name: 'hiuConsentInit',
    body,
    workflow: WORKFLOW.init,
    correlationId: id,
    milestone: 'M3',
    throwOnFailure: false,
  });
  const failed = result.status < 200 || result.status >= 300;
  const now = new Date();
  const saved = await repo.createConsentRequest({
    id,
    patientId: patient.id,
    facilityId: auth.facilityId,
    createdById: auth.userId,
    patientAbhaAddress: abhaAddress,
    purposeCode: input.purposeCode,
    purposeText: PURPOSES[input.purposeCode],
    purposeRefUri: refUri,
    hiTypes: input.hiTypes,
    accessMode: input.accessMode,
    frequency,
    dateFrom: new Date(input.dateFrom),
    dateTo: new Date(input.dateTo),
    expiresAt: new Date(input.dataEraseAt),
    dataEraseAt: new Date(input.dataEraseAt),
    requesterName,
    status: failed ? 'INIT_FAILED' : 'INIT_SENT',
    statusChangedAt: now,
    lastErrorCode: failed ? upstreamCode(result.body) : null,
    lastErrorMessage: failed ? (upstreamMessage(result.body) || `HTTP ${result.status}`) : null,
    transactionId: transaction.id,
  });

  if (idempotencyKey) {
    await saveIdempotency({
      key: idempotencyKey,
      userId: auth.userId,
      route,
      requestBodyHash: idem.hash,
      responseRef: saved.id,
    });
  }
  await logAudit({
    actorId: auth.userId,
    facilityId: auth.facilityId,
    action: 'hiu.consent.request',
    resourceType: 'consentRequest',
    resourceId: saved.id,
    outcome: failed ? 'failure' : 'success',
    correlationId: correlationId || result.requestId,
    message: failed
      ? `Consent request was refused by ABDM (${saved.lastErrorCode || result.status}).`
      : `Consent request raised for ${input.hiTypes.length} HI type(s).`,
  });
  return repo.findConsentRequest(saved.id);
}

export async function onInit(transaction, body) {
  const request = await eventually(() => repo.findConsentRequestByTransaction(transaction.id));
  if (!request) throw new AppError(404, 'CONSENT_REQUEST_UNKNOWN', 'on-init answers no stored consent request');
  if (body?.error || !body?.consentRequest?.id) {
    return moveRequest(request, 'INIT_FAILED', {
      lastErrorCode: upstreamCode(body) || null,
      lastErrorMessage: upstreamMessage(body) || 'on-init carried no consent request id',
    });
  }
  if (request.status !== 'INIT_SENT') {
    return repo.updateConsentRequest(request.id, { externalConsentRequestId: body.consentRequest.id });
  }
  return moveRequest(request, 'REQUESTED', { externalConsentRequestId: body.consentRequest.id });
}

export async function requestStatus({ id, auth, correlationId }) {
  const hiuId = requireHiuId();
  const request = await repo.findConsentRequest(id);
  if (!request || request.facilityId !== auth?.facilityId) {
    throw new AppError(404, 'CONSENT_REQUEST_NOT_FOUND', 'Consent request not found');
  }
  return pollStatus(request, hiuId, correlationId);
}

export async function pollStatus(request, hiuId = requireHiuId(), correlationId) {
  if (!request.externalConsentRequestId) {
    throw new AppError(409, 'CONSENT_REQUEST_PENDING', 'ABDM has not returned a consent request id yet');
  }
  const { result } = await callGateway({
    name: 'hiuConsentStatus',
    body: { consentRequestId: request.externalConsentRequestId },
    hiuId,
    workflow: WORKFLOW.status,
    correlationId: request.id,
    milestone: 'M3',
  });
  // [VERIFY] 200 with a body is the documented answer; 202 with no body means on-status follows.
  if (result.status === 200 && result.body?.consentRequest?.status) {
    await applyStatus(result.body);
  } else {
    await repo.updateConsentRequest(request.id, { updatedAt: new Date() });
  }
  await logAudit({
    action: 'hiu.consent.status',
    resourceType: 'consentRequest',
    resourceId: request.id,
    outcome: 'success',
    correlationId: correlationId || result.requestId,
    message: 'Consent request status was asked of ABDM.',
  });
  return { requestId: result.requestId, httpStatus: result.status };
}

async function applyStatus(body) {
  const consentRequest = body?.consentRequest;
  if (!consentRequest?.id) return null;
  const request = await repo.findConsentRequestByExternalId(consentRequest.id);
  if (!request) return null;
  return moveRequest(request, consentRequest.status);
}

export async function onStatus(transaction, body) {
  if (body?.error) {
    const request = await repo.findConsentRequest(transaction.correlationId);
    if (request) {
      await repo.updateConsentRequest(request.id, {
        lastErrorCode: upstreamCode(body),
        lastErrorMessage: upstreamMessage(body),
      });
    }
    return null;
  }
  return applyStatus(body);
}

/** Every artefact id in a notification. Plural by contract: one per HIP. */
export function artefactIds(notification) {
  return (notification?.consentArtefacts || [])
    .map((item) => item?.id)
    .filter(Boolean);
}

/**
 * ABDM can answer a consent request with a notify that carries an error and no status
 * (observed in the sandbox: ABDM-1120 "No care context available"). Nothing was granted,
 * so there is no artefact to acknowledge. Keep ABDM's own code and message on the request,
 * and answer 202 so the callback is PROCESSED rather than DEAD.
 */
async function handleNotifyError({ body, correlationId }) {
  const notification = body?.notification || {};
  const request = notification.consentRequestId
    ? await repo.findConsentRequestByExternalId(notification.consentRequestId)
    : null;
  const lastErrorCode = upstreamCode(body) || null;
  const lastErrorMessage = upstreamMessage(body) || 'ABDM reported an error for this consent request';

  if (request && !TERMINAL_STATES.has(request.status)) {
    if (request.status === 'INIT_SENT') {
      await moveRequest(request, 'INIT_FAILED', { lastErrorCode, lastErrorMessage });
    } else {
      // The state machine has no failed state after REQUESTED. Record the reason and leave the state alone.
      await repo.updateConsentRequest(request.id, { lastErrorCode, lastErrorMessage });
    }
  }
  await logAudit({
    action: 'hiu.consent.notify_error',
    resourceType: 'consentRequest',
    resourceId: request?.id ?? null,
    outcome: 'failure',
    correlationId,
    message: request
      ? `ABDM reported ${lastErrorCode || 'an error'} for a consent request: ${lastErrorMessage}`
      : `ABDM reported ${lastErrorCode || 'an error'} for a consent request this HIU could not match yet.`,
  });
  return request;
}

export async function handleNotify({ body, requestId, correlationId }) {
  const notification = body?.notification || {};
  if (body?.error && !notification.status) {
    return handleNotifyError({ body, correlationId });
  }
  const request = notification.consentRequestId
    ? await repo.findConsentRequestByExternalId(notification.consentRequestId)
    : null;
  const ids = artefactIds(notification);
  const now = new Date();

  if (!request && notification.status !== 'REVOKED') {
    await logAudit({
      action: 'hiu.callback',
      resourceType: 'callback',
      outcome: 'denied',
      correlationId,
      message: 'Consent notification dropped: it names no consent request this HIU raised.',
    });
    throw new AppError(404, 'CALLBACK_UNKNOWN', 'Notification names no consent request from this HIU');
  }

  let owner = request;
  if (notification.status === 'GRANTED') {
    for (const id of ids) {
      await repo.upsertArtefact(id, {
        consentRequestId: request.id,
        hiTypes: [],
        careContextRefs: [],
        status: 'GRANTED',
      }, { status: 'GRANTED', consentRequestId: request.id });
    }
    owner = await moveRequest(request, 'GRANTED', {}, now);
  } else if (notification.status === 'REVOKED') {
    for (const id of ids) {
      const artefact = await repo.findArtefactByExternalId(id);
      if (!artefact) continue;
      owner = owner || (artefact.consentRequestId ? await repo.findConsentRequest(artefact.consentRequestId) : null);
      await endArtefact(artefact, 'REVOKED', now);
    }
    if (owner) {
      const remaining = await repo.listArtefactsForRequest(owner.id);
      if (!remaining.some((item) => item.status === 'GRANTED')) {
        owner = await moveRequest(owner, 'REVOKED', {}, now);
      }
    }
  } else if (notification.status === 'DENIED' || notification.status === 'EXPIRED') {
    owner = await moveRequest(request, notification.status, {}, now);
  }

  if (!owner) {
    throw new AppError(404, 'CALLBACK_UNKNOWN', 'Revocation names no artefact held by this HIU');
  }

  // [VERIFY] For DENIED and EXPIRED there are no artefacts; the acknowledgement array is empty.
  await callGateway({
    name: 'hiuConsentOnNotify',
    body: {
      acknowledgement: ids.map((consentId) => ({ status: 'OK', consentId })),
      response: { requestId },
    },
    workflow: WORKFLOW.ack,
    correlationId: owner.id,
    milestone: 'M3',
  });
  await logAudit({
    action: 'hiu.consent.notify',
    resourceType: 'consentRequest',
    resourceId: owner.id,
    outcome: notification.status === 'GRANTED' ? 'success' : 'denied',
    correlationId,
    message: `Consent ${notification.status} notified for ${ids.length} artefact(s).`,
  });

  if (notification.status === 'GRANTED') {
    for (const id of ids) {
      const artefact = await repo.findArtefactByExternalId(id);
      try {
        await fetchArtefact(artefact);
      } catch (err) {
        logger.warn({ component: 'hiu.consent', code: err.code }, 'artefact fetch failed after grant');
      }
    }
  }
  return owner;
}

/** Revocation or expiry: the artefact stops serving, its records are purged, its keys wiped. */
export async function endArtefact(artefact, status, now = new Date()) {
  if (!artefact || artefact.status === status) return artefact;
  const stamp = status === 'REVOKED' ? { revokedAt: now } : { expiredAt: now };
  const updated = await repo.updateArtefact(artefact.id, { status, ...stamp });
  const purged = await repo.purgeRecords(artefact.id, status, now);
  await repo.wipeKeysForArtefact(artefact.id);
  await logAudit({
    action: 'hiu.records.purge',
    resourceType: 'consentArtefact',
    resourceId: artefact.id,
    outcome: 'success',
    message: `Consent artefact ${status}; ${purged?.count ?? 0} received record(s) purged.`,
  });
  return updated;
}

export async function fetchArtefact(artefact, correlationId) {
  if (!artefact) throw new AppError(404, 'ARTEFACT_NOT_FOUND', 'Consent artefact not found');
  const hiuId = requireHiuId();
  const { result } = await callGateway({
    name: 'hiuConsentFetch',
    body: { consentId: artefact.externalArtefactId },
    hiuId,
    workflow: WORKFLOW.fetch,
    correlationId: artefact.consentRequestId || correlationId || artefact.id,
    milestone: 'M3',
  });
  await repo.updateArtefact(artefact.id, { lastFetchRequestId: result.requestId });
  // [VERIFY] 200 with a body is the documented answer; 202 means on-fetch follows.
  if (result.status === 200 && result.body?.consent) {
    await applyFetched(artefact.id, result.body);
  }
  await logAudit({
    action: 'hiu.consent.fetch',
    resourceType: 'consentArtefact',
    resourceId: artefact.id,
    outcome: 'success',
    correlationId: correlationId || result.requestId,
    message: 'Consent artefact was fetched from ABDM.',
  });
  return { requestId: result.requestId, httpStatus: result.status };
}

async function applyFetched(artefactId, body) {
  const consent = body.consent || {};
  const detail = consent.consentDetail || {};
  const permission = detail.permission || {};
  const careContexts = Array.isArray(detail.careContexts) ? detail.careContexts : [];
  const status = consent.status || 'GRANTED';
  const data = {
    patientRef: detail.patient?.id || null,
    hipId: detail.hip?.id || null,
    hipName: detail.hip?.name || null,
    hiTypes: Array.isArray(detail.hiTypes) ? detail.hiTypes : [],
    careContexts,
    careContextRefs: careContexts.map((item) => item.careContextReference).filter(Boolean),
    accessMode: permission.accessMode || null,
    dateFrom: permission.dateRange?.from ? new Date(permission.dateRange.from) : null,
    dateTo: permission.dateRange?.to ? new Date(permission.dateRange.to) : null,
    expiresAt: permission.dataEraseAt || detail.dataEraseAt
      ? new Date(permission.dataEraseAt || detail.dataEraseAt)
      : null,
    signature: consent.signature || null,
    fetchedAt: new Date(),
    lastErrorCode: null,
    lastErrorMessage: null,
  };
  const updated = await repo.updateArtefact(artefactId, data);
  if (status === 'REVOKED' || status === 'EXPIRED') {
    await endArtefact(updated, status);
  } else if (status !== updated.status && status === 'GRANTED') {
    await repo.updateArtefact(artefactId, { status });
  }
  return updated;
}

export async function onFetch(transaction, body) {
  const artefact = await eventually(() => repo.findArtefactByFetchRequestId(transaction.requestId));
  if (!artefact) throw new AppError(404, 'ARTEFACT_UNKNOWN', 'on-fetch answers no stored artefact');
  if (body?.error && !body?.consent) {
    return repo.updateArtefact(artefact.id, {
      lastErrorCode: upstreamCode(body),
      lastErrorMessage: upstreamMessage(body),
    });
  }
  return applyFetched(artefact.id, body);
}
