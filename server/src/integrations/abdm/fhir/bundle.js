import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors.js';
import {
  CLAIMED_HI_TYPES,
  FETCHED_PROFILES,
  HI_TYPES,
  LOINC,
  SNOMED,
} from './profiles.js';

const CODING_SYSTEMS = new Set([SNOMED, LOINC]);

function referenceIds(bundle) {
  const ids = new Set();
  for (const entry of bundle.entry || []) {
    if (entry.fullUrl) ids.add(entry.fullUrl);
    if (entry.resource?.id && entry.resource?.resourceType) {
      ids.add(`${entry.resource.resourceType}/${entry.resource.id}`);
      ids.add(`urn:uuid:${entry.resource.id}`);
    }
  }
  return ids;
}

function isLocalRef(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  return true;
}

export function validateBundle(bundle, hiType) {
  const problems = [];
  if (!bundle || bundle.resourceType !== 'Bundle' || bundle.type !== 'document') {
    problems.push('Bundle.type must be document');
  }
  const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
  if (entries.length === 0) problems.push('Bundle.entry is empty');
  const composition = entries[0]?.resource;
  if (composition?.resourceType !== 'Composition') {
    problems.push('The first entry must be a Composition');
  }

  const known = referenceIds(bundle);
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}.${index}`));
      return;
    }
    if (typeof node.reference === 'string' && isLocalRef(node.reference) && !known.has(node.reference)) {
      problems.push(`${path}.reference points outside the bundle (${node.reference})`);
    }
    if (node.system && node.code && path.includes('coding') && !CODING_SYSTEMS.has(node.system)) {
      problems.push(`${path}.system must be SNOMED CT or LOINC`);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'reference') continue;
      walk(value, `${path}.${key}`);
    }
  };
  entries.forEach((entry, index) => walk(entry.resource, `entry.${index}`));

  const profile = FETCHED_PROFILES[hiType] || null;
  if (profile && composition) {
    const typeCoding = composition.type?.coding?.[0];
    if (typeCoding?.system !== SNOMED || typeCoding?.code !== profile.compositionCode) {
      problems.push('Composition.type does not match the fetched ImmunizationRecord profile');
    }
    const declared = composition.meta?.profile || [];
    if (!declared.includes(profile.url)) {
      problems.push('Composition.meta.profile does not declare the fetched profile');
    }
  }

  return { valid: problems.length === 0, problems, profile };
}

function coding(system, code, display) {
  if (!CODING_SYSTEMS.has(system)) {
    throw new AppError(400, 'FHIR_CODE_SYSTEM', 'Coded elements must use SNOMED CT or LOINC');
  }
  if (!code || !display) {
    throw new AppError(400, 'FHIR_CODE_REQUIRED', 'A SNOMED CT or LOINC code and display are required');
  }
  return { system, code, display };
}

function resourceTypeFor(hiType) {
  if (hiType === 'DiagnosticReport') return 'DiagnosticReport';
  if (hiType === 'Prescription') return 'MedicationRequest';
  if (hiType === 'Invoice') return 'Invoice';
  if (hiType === 'ImmunizationRecord') return 'Immunization';
  return 'DocumentReference';
}

export function buildBundle({
  hiType,
  patientId,
  patientName,
  gender,
  birthDate,
  occurredAt,
  facilityName,
  title,
  code,
  codeDisplay,
  codeSystem = SNOMED,
}) {
  if (!HI_TYPES.includes(hiType)) {
    throw new AppError(400, 'HI_TYPE_UNKNOWN', 'That health information type is not one ABDM lists');
  }
  const profile = FETCHED_PROFILES[hiType] || null;
  const when = new Date(occurredAt).toISOString();
  const patientRef = `urn:uuid:${patientId}`;
  const orgId = randomUUID();
  const orgRef = `urn:uuid:${orgId}`;
  const compositionId = randomUUID();
  const resourceId = randomUUID();
  const resourceType = profile?.entryType || resourceTypeFor(hiType);
  const clinicalCoding = profile
    ? coding(codeSystem, code, codeDisplay)
    : coding(codeSystem, code, codeDisplay);
  const compositionCoding = profile
    ? coding(SNOMED, profile.compositionCode, profile.compositionDisplay)
    : clinicalCoding;

  const composition = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: { coding: [compositionCoding] },
    subject: { reference: patientRef },
    date: when,
    author: [{ reference: orgRef }],
    title: title || `${hiType} on ${when.slice(0, 10)}`,
    section: [{
      title: title || hiType,
      code: { coding: [compositionCoding] },
      entry: [{ reference: `urn:uuid:${resourceId}`, type: resourceType }],
    }],
  };
  if (profile) composition.meta = { profile: [profile.url] };

  const bundle = {
    resourceType: 'Bundle',
    type: 'document',
    timestamp: when,
    identifier: { system: 'urn:chip:bundle', value: compositionId },
    entry: [
      { fullUrl: `urn:uuid:${compositionId}`, resource: composition },
      {
        fullUrl: patientRef,
        resource: {
          resourceType: 'Patient',
          id: patientId,
          name: [{ text: patientName }],
          gender: gender === 'M' ? 'male' : gender === 'F' ? 'female' : 'other',
          ...(birthDate ? { birthDate } : {}),
        },
      },
      {
        fullUrl: orgRef,
        resource: {
          resourceType: 'Organization',
          id: orgId,
          name: facilityName || 'Facility',
        },
      },
      {
        fullUrl: `urn:uuid:${resourceId}`,
        resource: clinicalResource({
          hiType,
          resourceType,
          resourceId,
          patientRef,
          when,
          clinicalCoding,
          title,
        }),
      },
    ],
  };

  const check = validateBundle(bundle, hiType);
  if (!check.valid) {
    throw new AppError(400, 'FHIR_INVALID', check.problems.join('; '));
  }
  const canonical = JSON.stringify(bundle);
  const claimed = Boolean(profile) && CLAIMED_HI_TYPES.includes(hiType);
  return {
    bundle,
    hiType,
    fhirProfile: profile?.url || null,
    igVersion: profile?.version || null,
    validationStatus: claimed ? 'VALID' : 'UNVERIFIED',
    validationSummary: claimed
      ? 'Checked against the fetched NRCES ImmunizationRecord profile.'
      : 'Structural checks passed. The NRCES profile URL for this HI type has not been fetched, so it is not linked.',
    sourceHash: createHash('sha256').update(canonical).digest('hex'),
    byteLength: Buffer.byteLength(canonical),
  };
}

function clinicalResource({
  hiType,
  resourceType,
  resourceId,
  patientRef,
  when,
  clinicalCoding,
  title,
}) {
  if (hiType === 'ImmunizationRecord') {
    return {
      resourceType: 'Immunization',
      id: resourceId,
      status: 'completed',
      vaccineCode: { coding: [clinicalCoding] },
      patient: { reference: patientRef },
      occurrenceDateTime: when,
    };
  }
  if (resourceType === 'DiagnosticReport') {
    return {
      resourceType,
      id: resourceId,
      status: 'final',
      code: { coding: [clinicalCoding] },
      subject: { reference: patientRef },
      effectiveDateTime: when,
    };
  }
  if (resourceType === 'MedicationRequest') {
    return {
      resourceType,
      id: resourceId,
      status: 'completed',
      intent: 'order',
      medicationCodeableConcept: { coding: [clinicalCoding] },
      subject: { reference: patientRef },
      authoredOn: when,
    };
  }
  if (resourceType === 'Invoice') {
    return {
      resourceType,
      id: resourceId,
      status: 'issued',
      type: { coding: [clinicalCoding] },
      subject: { reference: patientRef },
      date: when.slice(0, 10),
    };
  }
  return {
    resourceType: 'DocumentReference',
    id: resourceId,
    status: 'current',
    type: { coding: [clinicalCoding] },
    subject: { reference: patientRef },
    date: when,
    description: title || hiType,
    content: [{
      attachment: {
        contentType: 'application/fhir+json',
        title: title || hiType,
      },
    }],
  };
}

export function bundleSummary(built) {
  return {
    hiType: built.hiType,
    fhirProfile: built.fhirProfile,
    igVersion: built.igVersion,
    validationStatus: built.validationStatus,
    validationSummary: built.validationSummary,
    sourceHash: built.sourceHash,
    byteLength: built.byteLength,
    resourceTypes: (built.bundle.entry || []).map((entry) => entry.resource?.resourceType).filter(Boolean),
    title: built.bundle.entry?.[0]?.resource?.title || null,
  };
}
