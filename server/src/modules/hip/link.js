import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import {
  decryptAbhaNumberAtRest,
  encryptAbhaNumberAtRest,
} from '../abha/abha.crypto.js';
import { demographicsForHipLink } from '../abha/abha.service.js';
import * as repo from './hip.repository.js';
import { callGateway } from './gateway.js';

const SIX_MONTHS = 6;

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
