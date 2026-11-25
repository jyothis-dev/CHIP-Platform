import { http } from '@/shared/api/http.js';

export function login({ email, password }) {
  return http.post('/auth/login', { email, password });
}

export function logout() {
  return http.post('/auth/logout');
}

export function getMe() {
  return http.get('/auth/me');
}
