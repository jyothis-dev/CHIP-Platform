import { pageBody } from '../../shared/pagination.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { encryptAbhaNumberAtRest } from '../abha/abha.crypto.js';
import { demographicsForHipLink } from '../abha/abha.service.js';
import { buildBundle, bundleSummary, validateBundle } from '../../integrations/abdm/fhir/bundle.js';
import * as repo from './hip.repository.js';
import {
  DUPLICATE_LINK_MESSAGE,
  linkCareContextNow,
  cleanErrorCode,
  linkFailureHint,
  linkRetryable,
  sendSms,
  visitDisplay,
} from './link.js';

export function inspectBundle(input) {
  let built;
  try {
    built = buildBundle(input);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, 'FHIR_INVALID', 'The bundle could not be built', { cause: err });
  }
  const check = validateBundle(built.bundle, built.hiType);
  if (!check.valid) {
    throw new AppError(400, 'FHIR_INVALID', check.problems.join('; '));
  }
  return bundleSummary(built);
}

function failureBody(err) {
  const code = err.code || 'ABDM_UPSTREAM';
  const message = err.details?.abdmMessage || err.message || null;
  return { linkStatus: 'FAILED', code, message, hint: linkFailureHint(code, message) };
}

/** Mark a care context FAILED and keep the transaction that explains why. */
async function failLink(careContextId, err) {
  const transactionId = err.details?.transactionId;
  await repo.updateCareContext(careContextId, {
    linkStatus: 'FAILED',
    ...(transactionId ? { transactionId } : {}),
  });
  return failureBody(err);
}

export async function saveRecord({
  patientId,
  facilityId,
  actorId,
  correlationId,
  hiType,
  occurredAt,
  title,
  code,
  codeDisplay,
  codeSystem,
}) {
  const demographics = await demographicsForHipLink({ patientId, facilityId });
  if (!demographics.yearOfBirth && demographics.verified) {
    throw new AppError(400, 'YEAR_OF_BIRTH_REQUIRED', 'The patient needs a date of birth before a record can be linked');
  }
  const facility = await repo.findFacility(facilityId);
  const built = buildBundle({
    hiType,
    patientId,
    patientName: demographics.patient.name,
    gender: demographics.patient.gender,
    birthDate: demographics.patient.dateOfBirth
      ? new Date(demographics.patient.dateOfBirth).toISOString().slice(0, 10)
      : null,
    occurredAt,
    facilityName: facility?.name,
    title,
    code,
    codeDisplay,
    codeSystem,
  });
  const encounter = await repo.createEncounter({
    patientId,
    facilityId,
    type: hiType === 'ImmunizationRecord' ? 'IMMUNIZATION' : 'CHILD_FOLLOW_UP',
    occurredAt: new Date(occurredAt),
  });
  const record = await repo.createHealthRecord({
    patientId,
    encounterId: encounter.id,
    hiType,
    fhirProfile: built.fhirProfile,
    igVersion: built.igVersion,
    validationStatus: built.validationStatus,
    validationSummary: built.validationSummary,
    sourceHash: built.sourceHash,
    bundleEnc: encryptAbhaNumberAtRest(JSON.stringify(built.bundle)),
    bundleBytes: built.byteLength,
  });
  const careContext = await repo.createCareContext({
    facilityId,
    patientId,
    encounterId: encounter.id,
    healthRecordId: record.id,
    referenceNumber: encounter.id,
    display: visitDisplay(hiType, occurredAt),
    linkStatus: 'NOT_LINKED',
  });
  await logAudit({
    actorId,
    facilityId,
    action: 'hip.record',
    resourceType: 'healthRecord',
    resourceId: record.id,
    outcome: 'success',
    correlationId,
    message: `Saved ${hiType} record for ${demographics.patient.name}.`,
  });

  let link = { linkStatus: 'NOT_LINKED' };
  if (built.validationStatus !== 'VALID') {
    link = { linkStatus: 'NOT_LINKED', code: 'PROFILE_UNVERIFIED' };
  } else if (demographics.verified) {
    try {
      link = await linkCareContextNow({
        careContext: { ...careContext, hiType },
        patientId,
        demographics,
        facilityName: facility?.name,
        actorId,
        correlationId,
      });
    } catch (err) {
      link = await failLink(careContext.id, err);
    }
  } else if (demographics.patient.mobileEnc) {
    try {
      link = await sendSms({
        patient: demographics.patient,
        facilityName: facility?.name,
        correlationId,
        actorId,
      });
    } catch (err) {
      link = failureBody(err);
    }
  }

  if (!env.abdmCallbackBaseUrl && link.requestId) {
    link.callbackWarning = 'ABDM_CALLBACK_BASE_URL is not set, so the answer has nowhere to arrive';
  }

  return {
    record: {
      id: record.id,
      encounterId: encounter.id,
      hiType,
      validationStatus: built.validationStatus,
      validationSummary: built.validationSummary,
      sourceHash: built.sourceHash,
      byteLength: built.byteLength,
      fhirProfile: built.fhirProfile,
    },
    careContext: {
      id: careContext.id,
      referenceNumber: careContext.referenceNumber,
      display: careContext.display,
      linkStatus: link.linkStatus || careContext.linkStatus,
    },
    link,
  };
}

export async function retryLink({ careContextId, facilityId, actorId, correlationId }) {
  const careContext = await repo.findCareContextInFacility(careContextId, facilityId);
  if (!careContext) {
    throw new AppError(404, 'CARE_CONTEXT_NOT_FOUND', 'Care context not found');
  }
  if (!['FAILED', 'NOT_LINKED'].includes(careContext.linkStatus)) {
    throw new AppError(409, 'NOT_RETRYABLE', 'Only a failed or unlinked care context can be linked again');
  }
  const previousCode = careContext.transaction?.lastErrorCode || null;
  const previousMessage = careContext.transaction?.safeMetadata?.abdmMessage || null;
  if (String(previousMessage || '').toLowerCase().includes(DUPLICATE_LINK_MESSAGE.toLowerCase())) {
    throw new AppError(409, 'ALREADY_LINKED', 'ABDM says this care context is already linked. Do not retry.');
  }
  if (!linkRetryable(previousCode, previousMessage)) {
    throw new AppError(
      409,
      'DUPLICATE_LINK_TOKEN',
      'ABDM refuses a repeat of a refused link token request as a duplicate. Find the earlier failed exchange for this patient and fix that cause first.',
    );
  }
  if (!careContext.healthRecord || careContext.healthRecord.validationStatus !== 'VALID') {
    throw new AppError(409, 'RECORD_NOT_LINKABLE', 'The record has no valid bundle to link');
  }
  const demographics = await demographicsForHipLink({
    patientId: careContext.patientId,
    facilityId,
  });
  if (!demographics.verified) {
    throw new AppError(409, 'ABHA_NOT_VERIFIED', 'The patient needs a verified ABHA address before linking');
  }
  if (!demographics.yearOfBirth) {
    throw new AppError(400, 'YEAR_OF_BIRTH_REQUIRED', 'The patient needs a date of birth before a record can be linked');
  }
  const facility = await repo.findFacility(facilityId);

  let link;
  try {
    link = await linkCareContextNow({
      careContext: { ...careContext, hiType: careContext.healthRecord.hiType },
      patientId: careContext.patientId,
      demographics,
      facilityName: facility?.name,
      actorId,
      correlationId,
    });
  } catch (err) {
    link = await failLink(careContext.id, err);
  }
  await logAudit({
    actorId,
    facilityId,
    action: 'hip.link.retry',
    resourceType: 'careContext',
    resourceId: careContext.id,
    outcome: link.linkStatus === 'FAILED' ? 'failure' : 'success',
    correlationId,
    message: `Link retried for care context ${careContext.id}: ${link.linkStatus}.`,
  });
  return {
    careContext: { id: careContext.id, linkStatus: link.linkStatus },
    link,
  };
}

export function failureOf(transaction) {
  const code = cleanErrorCode(transaction?.lastErrorCode);
  const message = transaction?.safeMetadata?.abdmMessage || null;
  return { code, message, hint: linkFailureHint(code, message), retryable: linkRetryable(code, message) };
}

export async function listRecords(patientId, facilityId, page = 1, pageSize = 20) {
  const demographics = await demographicsForHipLink({ patientId, facilityId });
  const [visits, documents, notFindable, contexts] = await Promise.all([
    repo.countCareContexts(patientId),
    repo.countDocuments(patientId),
    repo.countNotFindable(patientId),
    repo.listCareContextPage(patientId, page, pageSize),
  ]);
  return {
    patientId,
    counts: { visits, documents, notFindable },
    careContexts: pageBody(contexts.map((row) => ({
      id: row.id,
      referenceNumber: row.referenceNumber,
      display: row.display,
      linkStatus: row.linkStatus,
      linkedAt: row.linkedAt,
      hiType: row.healthRecord?.hiType || null,
      validationStatus: row.healthRecord?.validationStatus || null,
      sourceHash: row.healthRecord?.sourceHash || null,
      byteLength: row.healthRecord?.bundleBytes || null,
      fhirProfile: row.healthRecord?.fhirProfile || null,
      failure: row.linkStatus === 'FAILED' ? failureOf(row.transaction) : null,
    })), page, pageSize, visits),
    abhaVerified: demographics.verified,
  };
}
