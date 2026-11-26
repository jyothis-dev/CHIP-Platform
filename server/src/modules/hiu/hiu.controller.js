import { pageBody } from '../../shared/pagination.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import * as repo from './hiu.repository.js';
import * as consent from './consent.js';
import * as dataflow from './dataflow.js';
import { listArtefactRecords } from './records.js';
import { hiuReadiness } from './readiness.js';
import { acceptHiuCallback } from './callbacks.js';
import { ACCESS_MODES, HIU_CLAIMED_HI_TYPES, HIU_HI_TYPES, PURPOSES } from './constants.js';

function patientView(patient) {
  if (!patient) return null;
  return {
    id: patient.id,
    name: patient.name,
    abhaAddress: patient.abhaIdentity?.abhaAddress || null,
    abhaNumberMasked: patient.abhaIdentity?.abhaNumberMasked || null,
  };
}

function requestRow(row) {
  return {
    id: row.id,
    patient: patientView(row.patient),
    abhaAddress: row.patientAbhaAddress,
    purposeCode: row.purposeCode,
    purposeText: row.purposeText,
    hiTypes: row.hiTypes,
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    dataEraseAt: row.dataEraseAt || row.expiresAt,
    status: row.status,
    statusChangedAt: row.statusChangedAt,
    grantedAt: row.grantedAt,
    deniedAt: row.deniedAt,
    expiredAt: row.expiredAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    externalConsentRequestId: row.externalConsentRequestId,
    artefactCount: row.artefacts?.length ?? 0,
  };
}

function artefactView(artefact) {
  return {
    id: artefact.id,
    externalArtefactId: artefact.externalArtefactId,
    status: artefact.status,
    hipId: artefact.hipId,
    hipName: artefact.hipName,
    hiTypes: artefact.hiTypes,
    careContexts: artefact.careContexts || [],
    accessMode: artefact.accessMode,
    dateFrom: artefact.dateFrom,
    dateTo: artefact.dateTo,
    dataEraseAt: artefact.expiresAt,
    fetchedAt: artefact.fetchedAt,
    revokedAt: artefact.revokedAt,
    expiredAt: artefact.expiredAt,
    lastErrorCode: artefact.lastErrorCode,
    lastErrorMessage: artefact.lastErrorMessage,
    informationRequests: (artefact.informationRequests || []).map((hir) => ({
      id: hir.id,
      status: hir.status,
      sessionStatus: hir.sessionStatus,
      externalTransactionId: hir.externalTransactionId,
      dateFrom: hir.dateFrom,
      dateTo: hir.dateTo,
      pagesExpected: hir.pagesExpected,
      pagesReceived: hir.pagesReceived,
      createdAt: hir.createdAt,
      lastErrorCode: hir.lastErrorCode,
      lastErrorMessage: hir.lastErrorMessage,
      transfers: (hir.dataTransfers || []).map((item) => ({
        careContextReference: item.careContextReference,
        status: item.status,
        receiptStatus: item.receiptStatus,
        receivedAt: item.receivedAt,
        pageNumber: item.pageNumber,
      })),
    })),
  };
}

export async function options(_req, res) {
  res.json({
    success: true,
    data: {
      purposes: Object.entries(PURPOSES).map(([code, text]) => ({ code, text })),
      hiTypes: HIU_HI_TYPES,
      claimedHiTypes: HIU_CLAIMED_HI_TYPES,
      accessModes: ACCESS_MODES,
    },
  });
}

export async function readiness(_req, res) {
  res.json({ success: true, data: await hiuReadiness() });
}

export async function createConsentRequest(req, res) {
  const row = await consent.raiseConsentRequest({
    input: req.validated.body,
    auth: req.auth,
    correlationId: req.id,
    idempotencyKey: req.get('idempotency-key') || null,
  });
  res.status(201).json({ success: true, data: requestRow(row) });
}

export async function listConsentRequests(req, res) {
  const { page, pageSize, patientId, status } = req.validated.query;
  const filter = { facilityId: req.auth.facilityId, patientId, status };
  const [total, rows] = await Promise.all([
    repo.countConsentRequests(filter),
    repo.listConsentRequests(filter, page, pageSize),
  ]);
  res.json({ success: true, data: pageBody(rows.map(requestRow), page, pageSize, total) });
}

export async function getConsentRequest(req, res) {
  const row = await repo.findConsentRequest(req.validated.params.id);
  if (!row || row.facilityId !== req.auth.facilityId) {
    throw new AppError(404, 'CONSENT_REQUEST_NOT_FOUND', 'Consent request not found');
  }
  const transactions = await repo.listM3Transactions([row.id]);
  res.json({
    success: true,
    data: {
      ...requestRow(row),
      requested: {
        hiTypes: row.hiTypes,
        dateFrom: row.dateFrom,
        dateTo: row.dateTo,
        dataEraseAt: row.dataEraseAt || row.expiresAt,
        accessMode: row.accessMode,
      },
      artefacts: row.artefacts.map(artefactView),
      timeline: transactions.map((item) => ({
        requestId: item.requestId,
        workflow: item.workflow,
        status: item.status,
        httpStatus: item.safeMetadata?.httpStatus ?? null,
        lastErrorCode: item.lastErrorCode,
        createdAt: item.createdAt,
        callbacks: (item.callbackEvents || []).map((event) => ({
          route: event.route,
          processingStatus: event.processingStatus,
          receivedAt: event.receivedAt,
        })),
      })),
    },
  });
}

export async function refreshStatus(req, res) {
  const data = await consent.requestStatus({
    id: req.validated.params.id,
    auth: req.auth,
    correlationId: req.id,
  });
  res.status(202).json({ success: true, data });
}

async function ownedArtefact(req) {
  const artefact = await repo.findArtefact(req.validated.params.id);
  if (!artefact || artefact.role !== 'HIU' || artefact.consentRequest?.facilityId !== req.auth.facilityId) {
    throw new AppError(404, 'ARTEFACT_NOT_FOUND', 'Consent artefact not found');
  }
  return artefact;
}

export async function fetchArtefact(req, res) {
  const artefact = await ownedArtefact(req);
  const data = await consent.fetchArtefact(artefact, req.id);
  res.status(202).json({ success: true, data });
}

export async function requestHealthInformation(req, res) {
  await ownedArtefact(req);
  const data = await dataflow.requestHealthInformation({
    artefactId: req.validated.params.id,
    ...req.validated.body,
    auth: req.auth,
    correlationId: req.id,
  });
  res.status(202).json({ success: true, data });
}

export async function artefactRecords(req, res) {
  const data = await listArtefactRecords({
    artefactId: req.validated.params.id,
    auth: req.auth,
    correlationId: req.id,
  });
  res.json({ success: true, data });
}

export async function healthInformationStatus(req, res) {
  const data = await dataflow.transferStatus({ id: req.validated.params.id });
  res.json({ success: true, data });
}

export async function callback(req, res) {
  const result = await acceptHiuCallback(req);
  res.status(202).json(result.duplicate ? { duplicate: true } : {});
}

/** dataPushUrl receiver. Answers 202 at once, then decrypts. */
export async function dataPush(req, res) {
  const { hir, duplicate } = await dataflow.acceptPush(req);
  res.status(202).json(duplicate ? { duplicate: true } : {});
  if (duplicate) return;
  setImmediate(() => {
    dataflow.processPush(hir, req.body || {}, req.id).catch((err) => {
      logger.error({ component: 'hiu.dataflow', code: err.code || err.name }, 'push processing failed');
    });
  });
}
