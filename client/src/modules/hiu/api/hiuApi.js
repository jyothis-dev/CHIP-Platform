import { http } from '@/shared/api/http.js';

export function getOptions() {
  return http.get('/hiu/options');
}

export function getReadiness() {
  return http.get('/hiu/readiness');
}

export function listConsentRequests({ page = 1, pageSize = 20, patientId, status } = {}) {
  return http.get('/hiu/consent-requests', {
    params: {
      page,
      pageSize,
      ...(patientId ? { patientId } : {}),
      ...(status ? { status } : {}),
    },
  });
}

export function createConsentRequest(body, idempotencyKey) {
  return http.post('/hiu/consent-requests', body, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  });
}

export function getConsentRequest(id) {
  return http.get(`/hiu/consent-requests/${id}`);
}

export function refreshStatus(id) {
  return http.post(`/hiu/consent-requests/${id}/status`, {});
}

export function fetchArtefact(id) {
  return http.post(`/hiu/artefacts/${id}/fetch`, {});
}

export function requestHealthInformation(id, body = {}, idempotencyKey) {
  return http.post(`/hiu/artefacts/${id}/health-information`, body, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  });
}

export function getArtefactRecords(id) {
  return http.get(`/hiu/artefacts/${id}/records`);
}
