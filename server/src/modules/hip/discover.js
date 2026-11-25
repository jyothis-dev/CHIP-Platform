import { randomUUID } from 'node:crypto';
import { logAudit } from '../../shared/audit.js';
import { hashMobile } from '../abha/abha.crypto.js';
import * as repo from './hip.repository.js';
import { callGateway } from './gateway.js';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function distance(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (Math.abs(a.length - b.length) > 2) return 99;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

function namesClose(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return distance(a, b) <= 2;
}

function verifiedValues(patient) {
  const rows = patient?.verifiedIdentifiers || patient?.identifiers || [];
  return Array.isArray(rows) ? rows : [];
}

export function choosePatient(candidates, profile) {
  const narrowed = candidates.filter((patient) => {
    if (profile.gender && patient.gender && patient.gender !== profile.gender) return false;
    if (profile.yearOfBirth && patient.dateOfBirth) {
      const year = new Date(patient.dateOfBirth).getUTCFullYear();
      if (year !== Number(profile.yearOfBirth)) return false;
    }
    if (profile.name && !namesClose(patient.name, profile.name)) return false;
    return true;
  });
  return narrowed.length === 1 ? narrowed[0] : null;
}

function groupsFor(patient) {
  const unlinked = (patient.careContexts || []).filter((row) => (
    row.linkStatus === 'NOT_LINKED' && row.healthRecord?.validationStatus === 'VALID'
  ));
  const byType = new Map();
  for (const row of unlinked) {
    const hiType = row.healthRecord.hiType;
    const bucket = byType.get(hiType) || [];
    bucket.push(row);
    byType.set(hiType, bucket);
  }
  return [...byType.entries()].map(([hiType, rows]) => ({
    referenceNumber: patient.id,
    display: 'Facility records',
    careContexts: rows.map((row) => ({
      referenceNumber: row.referenceNumber,
      display: row.display,
    })),
    hiType,
    count: rows.length,
  }));
}

export async function answerDiscover({ body, requestId, hiuId, correlationId }) {
  const transactionId = body?.transactionId;
  const profile = body?.patient || {};
  const mobiles = verifiedValues(profile)
    .filter((item) => String(item.type || '').toUpperCase().includes('MOBILE') && item.value)
    .map((item) => item.value);
  const found = [];
  for (const mobile of mobiles) {
    const rows = await repo.findPatientsByMobileHash(hashMobile(mobile));
    found.push(...rows);
  }
  if (profile.id && String(profile.id).includes('@')) {
    const byAddress = await repo.findPatientByAbhaAddress(profile.id);
    if (byAddress) found.push(byAddress);
  }
  const unique = [...new Map(found.map((row) => [row.id, row])).values()];
  const patient = choosePatient(unique, profile);
  const patientGroups = patient ? groupsFor(patient) : [];
  const inbound = await repo.createTransaction({
    requestId: requestId || randomUUID(),
    externalTxnId: transactionId || null,
    milestone: 'M2',
    workflow: 'hip.discover',
    direction: 'INBOUND',
    status: 'COMPLETED',
    correlationId: correlationId || requestId,
    safeMetadata: {
      patientId: patient?.id || null,
      matched: Boolean(patient),
      careContextRefs: patientGroups.flatMap((group) => group.careContexts.map((item) => item.referenceNumber)),
    },
    evidenceLabel: 'hip.discover',
  });
  await callGateway({
    name: 'onDiscover',
    workflow: 'hip.on-discover',
    correlationId,
    hiuId,
    body: {
      transactionId,
      patient: patientGroups,
      matchedBy: patient ? ['MR'] : [],
      response: { requestId },
    },
  });
  await logAudit({
    facilityId: patient?.facilityId || null,
    action: 'hip.discover',
    resourceType: 'patient',
    resourceId: patient?.id || inbound.id,
    outcome: patient ? 'success' : 'denied',
    correlationId,
    message: patient
      ? `Discovery returned unlinked records for ${patient.name}.`
      : 'Discovery matched no single patient.',
  });
}

function careRefs(body) {
  const refs = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (Array.isArray(node.careContexts)) {
      for (const item of node.careContexts) {
        if (item?.referenceNumber) refs.push(item.referenceNumber);
      }
    }
    Object.values(node).forEach(walk);
  };
  walk(body);
  return refs;
}

export async function answerInit({ body, requestId, correlationId }) {
  const transactionId = body?.transactionId;
  const prior = transactionId ? await repo.findTransactionByExternalId(transactionId) : null;
  const referenceNumber = randomUUID();
  await repo.createTransaction({
    requestId: requestId || randomUUID(),
    externalTxnId: transactionId || null,
    milestone: 'M2',
    workflow: 'hip.link-init',
    direction: 'INBOUND',
    status: 'COMPLETED',
    correlationId: correlationId || requestId,
    safeMetadata: {
      patientId: prior?.safeMetadata?.patientId || null,
      linkReference: referenceNumber,
      careContextRefs: careRefs(body).length ? careRefs(body) : (prior?.safeMetadata?.careContextRefs || []),
    },
    evidenceLabel: 'hip.link-init',
  });
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await callGateway({
    name: 'onInit',
    workflow: 'hip.on-init',
    correlationId,
    body: {
      transactionId,
      link: {
        referenceNumber,
        authenticationType: 'DIRECT',
        meta: {
          communicationMedium: 'MOBILE',
          communicationHint: 'OTP',
          communicationExpiry: expiry,
        },
      },
      response: { requestId },
    },
  });
}

export async function answerConfirm({ body, requestId, correlationId }) {
  const transactionId = body?.transactionId;
  const prior = transactionId ? await repo.findTransactionByExternalId(transactionId) : null;
  const refs = careRefs(body);
  const allowed = new Set(prior?.safeMetadata?.careContextRefs || []);
  const chosen = refs.filter((ref) => allowed.size === 0 || allowed.has(ref));
  const facilityId = null;
  for (const ref of chosen) {
    const row = facilityId
      ? await repo.findCareContextByReference(facilityId, ref)
      : null;
    if (row) {
      await repo.updateCareContext(row.id, { linkStatus: 'LINKED', linkedAt: new Date() });
    }
  }
  const patientId = prior?.safeMetadata?.patientId;
  if (patientId && chosen.length) {
    const contexts = await repo.listCareContexts(patientId);
    for (const row of contexts) {
      if (chosen.includes(row.referenceNumber)) {
        await repo.updateCareContext(row.id, { linkStatus: 'LINKED', linkedAt: new Date() });
      }
    }
  }
  await callGateway({
    name: 'onConfirm',
    workflow: 'hip.on-confirm',
    correlationId,
    body: {
      patient: body?.patient || [],
      response: { requestId },
    },
  });
  await logAudit({
    action: 'hip.link',
    resourceType: 'patient',
    resourceId: patientId || requestId,
    outcome: 'success',
    correlationId,
    message: 'User-initiated linking was confirmed.',
  });
}
