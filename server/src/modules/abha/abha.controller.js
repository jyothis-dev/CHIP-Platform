import * as abhaService from './abha.service.js';
import { listAbdmTraces } from '../../integrations/abdm/trace.js';

function ctx(req) {
  return {
    actorId: req.auth.userId,
    actorName: req.auth.name,
    facilityId: req.auth.facilityId,
    correlationId: req.id,
    idempotencyKey: req.get('idempotency-key') || null,
  };
}

export async function listTraces(req, res) {
  const query = req.validated?.query || {};
  const data = await listAbdmTraces({
    page: query.page,
    pageSize: query.pageSize,
  });
  res.status(200).json({ success: true, data });
}

export async function requestOtp(req, res) {
  const body = req.validated.body;
  const data = body.resend
    ? await abhaService.resendOtp({
      transactionId: body.transactionId,
      channel: body.channel,
      ...ctx(req),
    })
    : await abhaService.requestAadhaarOtp({
      ...body,
      ...ctx(req),
    });
  res.status(body.resend ? 200 : 201).json({ success: true, data });
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
