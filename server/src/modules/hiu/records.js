import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { decryptAbhaNumberAtRest } from '../abha/abha.crypto.js';
import * as repo from './hiu.repository.js';
import { artefactRefusal } from './dataflow.js';

function compositionSummary(bundle) {
  const composition = bundle?.entry?.[0]?.resource || {};
  return {
    title: composition.title || null,
    date: composition.date || null,
    type: composition.type?.coding?.[0]?.display || composition.type?.text || null,
    sections: (composition.section || []).map((section) => ({
      title: section.title || section.code?.coding?.[0]?.display || null,
      entries: (section.entry || []).length,
    })),
  };
}

/**
 * Records received under one artefact. A revoked or expired artefact answers
 * 410 with the reason, never an empty list (HIU_FLOW_202, HIU_FLOW_301).
 */
export async function listArtefactRecords({ artefactId, auth, correlationId }) {
  const artefact = await repo.findArtefact(artefactId);
  if (!artefact || artefact.role !== 'HIU'
    || (artefact.consentRequest && artefact.consentRequest.facilityId !== auth.facilityId)) {
    throw new AppError(404, 'ARTEFACT_NOT_FOUND', 'Consent artefact not found');
  }
  const refusal = artefactRefusal(artefact);
  if (refusal && refusal.status === 410) {
    throw new AppError(410, refusal.code, refusal.message, { details: { at: refusal.at || null } });
  }
  const granted = new Set(artefact.hiTypes || []);
  const rows = await repo.listReceivedRecords(artefact.id);
  const items = rows
    .filter((row) => row.bundleEnc && row.hiType && granted.has(row.hiType))
    .map((row) => {
      const bundle = JSON.parse(decryptAbhaNumberAtRest(row.bundleEnc));
      return {
        id: row.id,
        hiType: row.hiType,
        careContextReference: row.careContextReference,
        receivedAt: row.receivedAt,
        checksumOk: row.checksumOk,
        validationStatus: row.validationStatus,
        validationProblems: row.validationProblems || [],
        summary: compositionSummary(bundle),
        bundle,
      };
    });
  await logAudit({
    actorId: auth.userId,
    facilityId: auth.facilityId,
    action: 'hiu.records.view',
    resourceType: 'consentArtefact',
    resourceId: artefact.id,
    outcome: 'success',
    correlationId,
    message: `Staff viewed ${items.length} received health record(s).`,
  });
  return { artefactId: artefact.id, hiTypes: artefact.hiTypes, items };
}
