import * as immunization from './immunization.service.js';

export async function list(req, res) {
  const data = await immunization.listHistory(req.auth, req.validated.params.id);
  res.json({ success: true, data });
}

export async function nextDue(req, res) {
  const data = await immunization.nextDue(req.auth, req.validated.params.id);
  res.json({ success: true, data });
}

export async function create(req, res) {
  const data = await immunization.recordDose(req.auth, req.validated.params.id, req.validated.body, {
    requestId: req.id,
    ip: req.ip,
  });
  res.status(201).json({ success: true, data });
}
