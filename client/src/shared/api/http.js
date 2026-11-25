import axios from 'axios';
import { clearToken, getToken } from './token.js';
import { ApiError, toApiError } from './errors.js';
import { notifyUnauthorized } from './sessionEvents.js';

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const payload = response.data;
    if (payload && typeof payload === 'object' && 'success' in payload) {
      if (payload.success === false) {
        throw new ApiError({
          message: payload.message || 'Request failed',
          status: response.status,
          code: payload.code,
          details: payload.details || null,
        });
      }
      return payload.data;
    }
    return payload;
  },
  (error) => {
    const apiError = toApiError(error);
    const url = String(error?.config?.url || '');
    const isLogin = url.includes('/auth/login');
    if (apiError.status === 401 && !isLogin) {
      clearToken();
      notifyUnauthorized();
    }
    return Promise.reject(apiError);
  },
);
