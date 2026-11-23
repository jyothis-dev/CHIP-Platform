import * as organisation from './organisation.service.js';

function ctx(req) {
  return { requestId: req.id, ip: req.ip };
}

export async function listHospitals(req, res) {
  const data = await organisation.listHospitals(req.auth);
  res.json({ success: true, data });
}

export async function createHospital(req, res) {
  const data = await organisation.createHospital(req.auth, req.validated.body, ctx(req));
  res.status(201).json({ success: true, data });
}

export async function getHospital(req, res) {
  const data = await organisation.getHospital(req.auth, req.validated.params.id);
  res.json({ success: true, data });
}

export async function listDepartments(req, res) {
  const data = await organisation.listDepartments(req.auth, req.validated.params.id);
  res.json({ success: true, data });
}

export async function createDepartment(req, res) {
  const data = await organisation.createDepartment(
    req.auth,
    req.validated.params.id,
    req.validated.body,
    ctx(req),
  );
  res.status(201).json({ success: true, data });
}

export async function listRoles(req, res) {
  const data = await organisation.listRoles(req.auth, req.validated.params.id);
  res.json({ success: true, data });
}

export async function createRole(req, res) {
  const data = await organisation.createRole(
    req.auth,
    req.validated.params.id,
    req.validated.body,
    ctx(req),
  );
  res.status(201).json({ success: true, data });
}

export async function setRolePermissions(req, res) {
  const data = await organisation.setRolePermissions(
    req.auth,
    req.validated.params.id,
    req.validated.params.roleId,
    req.validated.body.permissionKeys,
    ctx(req),
  );
  res.json({ success: true, data });
}

export async function listPermissions(_req, res) {
  const data = await organisation.listPermissions();
  res.json({ success: true, data });
}

export async function listStaff(req, res) {
  const data = await organisation.listStaff(req.auth, req.validated.params.id);
  res.json({ success: true, data });
}

export async function createStaff(req, res) {
  const data = await organisation.createStaff(
    req.auth,
    req.validated.params.id,
    req.validated.body,
    ctx(req),
  );
  res.status(201).json({ success: true, data });
}
