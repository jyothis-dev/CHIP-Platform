import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import {
  decryptAbhaNumberAtRest,
  encryptAbhaNumberAtRest,
} from '../abha/abha.crypto.js';
import { demographicsForHipLink } from '../abha/abha.service.js';
import * as repo from './hip.repository.js';
import { callGateway, upstreamMessage } from './gateway.js';

const SIX_MONTHS = 6;

const ABHA_ADDRESS_FORMAT = /^[a-zA-Z0-9][a-zA-Z0-9_.]+[a-zA-Z0-9]@(abdm|sbx)$/;
const NAME_FORMAT = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/;
const GENDERS = new Set(['M', 'F', 'O', 'D', 'T', 'U']);

/**
 * Check the generate-token body against the documented patterns before anything is sent.
 * ABDM remembers a refused request and rate-limits repeats (ABDM-1092, ABDM-1022, ABDM-1027),
 * so an input that cannot be accepted must never reach the gateway.
 */
export function linkInputProblems(demographics) {
  const problems = [];
  if (!ABHA_ADDRESS_FORMAT.test(String(demographics?.abhaAddress || ''))) {
    problems.push('ABHA address must look like name@sbx');
  }
  if (!NAME_FORMAT.test(String(demographics?.name || '').trim())) {
    problems.push("name may contain only letters and the characters ' , . -");
  }
  if (!GENDERS.has(String(demographics?.gender || ''))) {
    problems.push('gender must be one of M, F, O, D, T, U');
  }
  const year = Number(demographics?.yearOfBirth);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    problems.push('year of birth must be between 1900 and 2200');
  }
  return problems;
}

export const DUPLICATE_LINK_MESSAGE = 'Duplicate HIP link request';

/** ABDM-1092: a refused link token request is remembered, so an identical retry is refused (hiecm.concept.m2-retry-is-a-duplicate). */
export function isDuplicateLinkToken(rawCode, message) {
  return cleanErrorCode(rawCode) === 'ABDM-1092' || String(message || '').toLowerCase().includes('duplicate link token request');
}

/** False when a retry cannot succeed: it would only repeat the refusal and risk ABDM's rate limit. */
export function linkRetryable(code, message) {
  return !isDuplicateLinkToken(code, message)
    && !String(message || '').toLowerCase().includes(DUPLICATE_LINK_MESSAGE.toLowerCase());
}

/**
 * Plain-words next step for a failed link. ABDM-9999 is a catch-all, so the message decides
 * (catalogue atom hiecm.error.abdm-9999). Returns null when there is nothing safe to add.
 */
/** ABDM sometimes sends a code with a trailing separator, `ABDM-1207: `. */
export function cleanErrorCode(code) {
  const text = String(code || '').replace(/:\s*$/, '').trim();
  return text || null;
}

export function linkFailureHint(rawCode, message) {
  const code = cleanErrorCode(rawCode);
  const text = String(message || '').toLowerCase();
  if (isDuplicateLinkToken(code, message)) {
    return 'ABDM remembers the earlier refusal and treats a repeat as a duplicate, so this is not a new failure. Do not retry. The earlier failed exchange for this patient holds the real cause.';
  }
  if (text.includes(DUPLICATE_LINK_MESSAGE.toLowerCase())) {
    return 'This care context is already linked. Do not retry.';
  }
  if (code === 'ABDM-1207') {
    return 'The name, gender or year of birth do not match the Aadhaar record. Enrol the patient again so the details are taken from the ABHA profile, then link.';
  }
  if (text.includes('unable to generate a token') || text.includes('hip is unable to process')) {
    return 'ABDM could not reach this HIP. Check that the callback URL is current, click Register callback URL, then retry.';
  }
  if (text.includes('user not found')) {
    return 'ABDM does not know this ABHA address. Check its spelling and the @sbx suffix.';
  }
  if (code === 'ABDM-9999') {
    return 'ABDM could not process the request. Retry later. If it keeps failing, contact support with the request id.';
  }
  return null;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function abhaNumberValue(abhaNumber) {
  const digits = String(abhaNumber).replace(/\D/g, '');
  const asNumber = Number(digits);
  return Number.isSafeInteger(asNumber) ? asNumber : digits;
}

export function visitDisplay(hiType, occurredAt) {
  const label = new Date(occurredAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${hiType} visit on ${label}`;
}

async function usableToken(patientId, hipId, abhaAddress) {
  const row = await repo.findValidLinkToken(patientId, hipId, abhaAddress, new Date());
  if (!row) return null;
  return decryptAbhaNumberAtRest(row.tokenEnc);
}

export async function linkCareContextNow({
  careContext,
  patientId,
  demographics,
  facilityName,
  actorId,
  correlationId,
}) {
  if (!env.abdmHipId) {
    return { linkStatus: 'NOT_LINKED', code: 'HIP_ID_MISSING' };
  }
  const problems = linkInputProblems(demographics);
  if (problems.length) {
    return {
      linkStatus: 'NOT_LINKED',
      code: 'LINK_INPUT_INVALID',
      message: `Nothing was sent to ABDM: ${problems.join('; ')}.`,
      hint: 'Correct the patient details, then use Link now.',
    };
  }
  const token = await usableToken(patientId, env.abdmHipId, demographics.abhaAddress);
  if (!token) {
    const { transaction } = await callGateway({
      name: 'generateLinkToken',
      workflow: 'hip.link-token',
      correlationId,
      body: {
        abhaNumber: abhaNumberValue(demographics.abhaNumber),
        abhaAddress: demographics.abhaAddress,
        name: demographics.name,
        gender: demographics.gender,
        yearOfBirth: demographics.yearOfBirth,
      },
    });
    await repo.updateTransaction(transaction.id, {
      safeMetadata: {
        httpStatus: 202,
        path: '/api/hiecm/v3/token/generate-token',
        careContextId: careContext.id,
        patientId,
        facilityId: careContext.facilityId,
        facilityName,
        referenceNumber: careContext.referenceNumber,
        display: careContext.display,
        hiType: careContext.hiType,
      },
    });
    await repo.updateCareContext(careContext.id, {
      transactionId: transaction.id,
      linkStatus: 'LINK_REQUESTED',
    });
    return { linkStatus: 'LINK_REQUESTED', requestId: transaction.requestId };
  }

  return sendLink({
    careContext,
    demographics,
    token,
    facilityName,
    actorId,
    correlationId,
  });
}

async function sendLink({ careContext, demographics, token, facilityName, actorId, correlationId }) {
  const { transaction } = await callGateway({
    name: 'linkCareContext',
    workflow: 'hip.link',
    correlationId,
    linkToken: token,
    body: {
      abhaNumber: abhaNumberValue(demographics.abhaNumber),
      abhaAddress: demographics.abhaAddress,
      patient: [{
        referenceNumber: careContext.patientId,
        display: facilityName || 'Facility records',
        careContexts: [{
          referenceNumber: careContext.referenceNumber,
          display: careContext.display,
        }],
        hiType: careContext.hiType,
        count: 1,
      }],
    },
  });
  await repo.updateTransaction(transaction.id, {
    safeMetadata: {
      httpStatus: 202,
      path: '/api/hiecm/hip/v3/link/carecontext',
      careContextId: careContext.id,
      patientId: careContext.patientId,
    },
  });
  await repo.updateCareContext(careContext.id, {
    transactionId: transaction.id,
    linkStatus: 'LINK_REQUESTED',
  });
  await logAudit({
    actorId: actorId || null,
    facilityId: careContext.facilityId,
    action: 'hip.link',
    resourceType: 'careContext',
    resourceId: careContext.id,
    outcome: 'success',
    correlationId,
    message: `Care context link requested for patient ${careContext.patientId}.`,
  });
  return { linkStatus: 'LINK_REQUESTED', requestId: transaction.requestId };
}

export async function completeLinkToken(transaction, body) {
  const token = body?.linkToken;
  const errored = body?.error && !token;
  if (errored || !token) {
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: body?.error?.code || 'LINK_TOKEN_FAILED',
      safeMetadata: { ...(transaction.safeMetadata || {}), abdmMessage: upstreamMessage(body) },
    });
    const careContextId = transaction.safeMetadata?.careContextId;
    if (careContextId) {
      await repo.updateCareContext(careContextId, { linkStatus: 'FAILED' });
    }
    return;
  }
  const issuedAt = new Date();
  await repo.createLinkToken({
    patientId: transaction.safeMetadata.patientId,
    hipId: env.abdmHipId,
    tokenEnc: encryptAbhaNumberAtRest(token),
    abhaAddress: body.abhaAddress,
    issuedAt,
    expiresAt: addMonths(issuedAt, SIX_MONTHS),
    requestId: transaction.requestId,
  });
  await repo.updateTransaction(transaction.id, { status: 'COMPLETED' });
  const meta = transaction.safeMetadata || {};
  const demographics = await demographicsForHipLink({
    patientId: meta.patientId,
    facilityId: meta.facilityId,
  });
  await sendLink({
    careContext: {
      id: meta.careContextId,
      patientId: meta.patientId,
      facilityId: meta.facilityId,
      referenceNumber: meta.referenceNumber,
      display: meta.display,
      hiType: meta.hiType,
    },
    demographics,
    token,
    correlationId: transaction.correlationId,
  });
}

export async function markLinkResult(transaction, body) {
  const failed = Boolean(body?.error);
  await repo.updateTransaction(transaction.id, {
    status: failed ? 'FAILED' : 'COMPLETED',
    lastErrorCode: failed ? (body.error.code || 'LINK_FAILED') : null,
    ...(failed
      ? { safeMetadata: { ...(transaction.safeMetadata || {}), abdmMessage: upstreamMessage(body) } }
      : {}),
  });
  const careContextId = transaction.safeMetadata?.careContextId;
  if (careContextId) {
    await repo.updateCareContext(careContextId, {
      linkStatus: failed ? 'FAILED' : 'LINKED',
      linkedAt: failed ? null : new Date(),
    });
  }
}

export async function notifyContext(careContext, demographics, correlationId) {
  if (!env.abdmHipId || careContext.linkStatus !== 'LINKED') return null;
  return callGateway({
    name: 'contextNotify',
    workflow: 'hip.context-notify',
    correlationId,
    body: {
      notification: {
        patient: { id: demographics.abhaAddress },
        careContext: {
          patientReference: careContext.patientId,
          careContextReference: careContext.referenceNumber,
        },
        hiTypes: [careContext.hiType],
        date: new Date().toISOString(),
        hip: { id: env.abdmHipId },
      },
    },
  });
}

export async function sendSms({ patient, facilityName, correlationId, actorId }) {
  if (!env.abdmHipId) return { code: 'HIP_ID_MISSING' };
  if (!patient.mobileEnc) {
    throw new AppError(409, 'MOBILE_UNAVAILABLE', 'This patient has no mobile that can receive a link');
  }
  const phoneNo = decryptAbhaNumberAtRest(patient.mobileEnc);
  const { transaction } = await callGateway({
    name: 'smsNotify',
    workflow: 'hip.sms-notify',
    correlationId,
    body: {
      notification: {
        phoneNo,
        hip: { id: env.abdmHipId, name: facilityName || 'Facility' },
      },
    },
  });
  await logAudit({
    actorId: actorId || null,
    facilityId: patient.facilityId,
    action: 'hip.link',
    resourceType: 'patient',
    resourceId: patient.id,
    outcome: 'success',
    correlationId,
    message: `Deep link SMS requested for patient ${patient.name}.`,
  });
  return { linkStatus: 'LINK_REQUESTED', requestId: transaction.requestId };
}

export async function markSmsResult(transaction, body) {
  const ok = body?.acknowledgement?.status === 'SUCCESS' && !body?.error;
  await repo.updateTransaction(transaction.id, {
    status: ok ? 'COMPLETED' : 'FAILED',
    lastErrorCode: ok ? null : (body?.error?.code || 'SMS_FAILED'),
  });
}
