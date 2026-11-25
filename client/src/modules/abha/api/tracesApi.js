import { http } from '@/shared/api/http.js';

export function listTraces({ page = 1, pageSize = 20 } = {}) {
  return http.get('/abha/traces', { params: { page, pageSize } });
}
