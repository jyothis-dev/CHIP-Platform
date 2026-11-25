import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { encryptAbhaNumberAtRest } from '../abha/abha.crypto.js';
import { demographicsForHipLink } from '../abha/abha.service.js';
import { buildBundle, bundleSummary, validateBundle } from '../../integrations/abdm/fhir/bundle.js';
import * as repo from './hip.repository.js';
import { linkCareContextNow, sendSms, visitDisplay } from './link.js';

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
      link = {
        linkStatus: 'FAILED',
        code: err.code || 'ABDM_UPSTREAM',
        message: err.message,
      };
      await repo.updateCareContext(careContext.id, { linkStatus: 'FAILED' });
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
      link = { linkStatus: 'FAILED', code: err.code || 'ABDM_UPSTREAM', message: err.message };
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

export async function listRecords(patientId, facilityId) {
  const demographics = await demographicsForHipLink({ patientId, facilityId });
  const contexts = await repo.listCareContexts(patientId);
  const visits = contexts.length;
  const documents = contexts.filter((row) => row.healthRecordId).length;
  const notFindable = contexts.filter((row) => row.linkStatus !== 'LINKED' && row.healthRecord?.validationStatus === 'VALID').length;
  return {
    patientId,
    counts: { visits, documents, notFindable },
    careContexts: contexts.map((row) => ({
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
    })),
    abhaVerified: demographics.verified,
  };
}
