import axios from 'axios';
import { clearToken, getToken } from './token.js';
import { ApiError, toApiError } from './errors.js';
import { notifyUnauthorized } from './sessionEvents.js';
import { refreshAccessToken } from './refreshSession.js';

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
    const config = error?.config;
    const url = String(config?.url || '');
    const isLogin = url.includes('/auth/login');
    const isRefresh = url.includes('/auth/refresh');
    if (apiError.status === 401 && !isLogin && !isRefresh && config && !config._retry) {
      return refreshAccessToken()
        .then((token) => {
          config._retry = true;
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          return http.request(config);
        })
        .catch(() => {
          clearToken();
          notifyUnauthorized();
          return Promise.reject(apiError);
        });
    }
    if (apiError.status === 401 && !isLogin) {
      clearToken();
      notifyUnauthorized();
    }
    return Promise.reject(apiError);
  },
);
