import * as abhaService from './abha.service.js';

function ctx(req) {
  return {
    actorId: req.auth.userId,
    facilityId: req.auth.facilityId,
    correlationId: req.id,
    idempotencyKey: req.get('idempotency-key') || null,
  };
}

export async function requestOtp(req, res) {
  const data = await abhaService.requestAadhaarOtp({
    ...req.validated.body,
    ...ctx(req),
  });
  res.status(201).json({ success: true, data });
}

export async function verifyOtp(req, res) {
  const data = await abhaService.verifyAadhaarOtp({
    ...req.validated.body,
    ...ctx(req),
  });
  res.status(200).json({ success: true, data });
}

export async function verifyMobile(req, res) {
  const data = await abhaService.verifyMobileOtp({
    ...req.validated.body,
    ...ctx(req),
  });
  res.status(200).json({ success: true, data });
}

export async function addressSuggestions(req, res) {
  const data = await abhaService.suggestAddress({
    transactionId: req.validated.params.transactionId,
    ...ctx(req),
  });
  res.status(200).json({ success: true, data });
}

export async function createAddress(req, res) {
  const data = await abhaService.createAddress({
    ...req.validated.body,
    ...ctx(req),
  });
  res.status(200).json({ success: true, data });
}

export async function getPatientAbha(req, res) {
  const data = await abhaService.getPatientAbha({
    patientId: req.validated.params.id,
    ...ctx(req),
  });
  res.status(200).json({ success: true, data });
}

export async function getCard(req, res) {
  const data = await abhaService.getAbhaCard({
    transactionId: req.validated.params.transactionId,
    ...ctx(req),
  });
  res.status(200).json({ success: true, data });
}
