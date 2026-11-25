import { http } from '@/shared/api/http.js';

export function listPatients({ q } = {}) {
  return http.get('/patients', { params: q ? { q } : undefined });
}

export function getPatient(id) {
  return http.get(`/patients/${id}`);
}

export function createPatient(body) {
  return http.post('/patients', body);
}
