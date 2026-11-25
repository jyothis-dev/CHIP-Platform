import * as patientsService from './patients.service.js';

export async function list(req, res) {
  const data = await patientsService.listPatients({
    facilityId: req.auth.facilityId,
    q: req.validated.query?.q,
  });
  res.status(200).json({ success: true, data });
}

export async function create(req, res) {
  const body = req.validated.body;
  const data = await patientsService.createPatient({
    facilityId: req.auth.facilityId,
    actorId: req.auth.userId,
    actorName: req.auth.name,
    patientType: body.patientType,
    name: body.name,
    gender: body.gender,
    dateOfBirth: body.dateOfBirth,
    mobile: body.mobile,
    correlationId: req.id,
  });
  res.status(201).json({ success: true, data });
}

export async function getById(req, res) {
  const data = await patientsService.getPatient({
    patientId: req.validated.params.id,
    facilityId: req.auth.facilityId,
  });
  res.status(200).json({ success: true, data });
}
