import * as audit from './audit.service.js';

export async function list(req, res) {
  const data = await audit.listForHospital(req.auth.hospitalId);
  res.json({ success: true, data });
}
