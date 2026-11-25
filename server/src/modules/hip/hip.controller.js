import { pageBody } from '../../shared/pagination.js';
import * as records from './records.js';
import * as readiness from './readiness.js';
import * as repo from './hip.repository.js';
import { acceptCallback } from './callbacks.js';

export async function inspect(req, res) {
  const data = records.inspectBundle(req.validated.body);
  res.status(200).json({ success: true, data });
}

export async function createRecord(req, res) {
  const data = await records.saveRecord({
    patientId: req.validated.params.id,
    facilityId: req.auth.facilityId,
    actorId: req.auth.userId,
    correlationId: req.id,
    ...req.validated.body,
  });
  res.status(201).json({ success: true, data });
}

export async function listRecords(req, res) {
  const data = await records.listRecords(
    req.validated.params.id,
    req.auth.facilityId,
    req.validated.query?.page,
    req.validated.query?.pageSize,
  );
  res.status(200).json({ success: true, data });
}

export async function getReadiness(req, res) {
  const data = await readiness.readiness();
  res.status(200).json({ success: true, data });
}

export async function registerBridge(req, res) {
  const data = await readiness.registerCallback({ confirm: req.validated.body.confirm });
  res.status(200).json({ success: true, data });
}

export async function exchanges(req, res) {
  const page = req.validated.query?.page;
  const pageSize = req.validated.query?.pageSize;
  const [total, rows] = await Promise.all([
    repo.countExchanges(),
    repo.listExchanges(req.auth.facilityId, page, pageSize),
  ]);
  const items = rows.map((row) => ({
    requestId: row.requestId,
    workflow: row.workflow,
    direction: row.direction,
    status: row.status,
    createdAt: row.createdAt,
    callbacks: (row.callbackEvents || []).map((event) => ({
      route: event.route,
      processingStatus: event.processingStatus,
      receivedAt: event.receivedAt,
    })),
  }));
  res.status(200).json({ success: true, data: pageBody(items, page, pageSize, total) });
}

export async function callback(req, res) {
  const result = await acceptCallback(req);
  res.status(202).json(result.duplicate ? { duplicate: true } : {});
}
