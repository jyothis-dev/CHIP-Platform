import * as children from './children.service.js';

function ctx(req) {
  return { requestId: req.id, ip: req.ip };
}

export async function list(req, res) {
  res.json({ success: true, data: await children.listChildren(req.auth) });
}

export async function getOne(req, res) {
  res.json({ success: true, data: await children.getChild(req.auth, req.validated.params.id) });
}

export async function create(req, res) {
  const data = await children.createChild(req.auth, req.validated.body, ctx(req));
  res.status(201).json({ success: true, data });
}

export async function createGuardian(req, res) {
  const data = await children.addGuardian(req.auth, req.validated.params.id, req.validated.body, ctx(req));
  res.status(201).json({ success: true, data });
}

export async function listGuardians(req, res) {
  res.json({ success: true, data: await children.listGuardians(req.auth, req.validated.params.id) });
}
