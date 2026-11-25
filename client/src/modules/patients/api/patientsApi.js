import { http } from '@/shared/api/http.js';

export function listPatients({ q, page = 1, pageSize = 20 } = {}) {
  return http.get('/patients', {
    params: {
      page,
      pageSize,
      ...(q ? { q } : {}),
    },
  });
}

export function getPatient(id) {
  return http.get(`/patients/${id}`);
}

export function createPatient(body) {
  return http.post('/patients', body);
}
