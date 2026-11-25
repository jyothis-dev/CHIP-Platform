import { http } from '@/shared/api/http.js';

export function listTraces() {
  return http.get('/abha/traces');
}
