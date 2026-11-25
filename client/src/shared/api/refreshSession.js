import axios from 'axios';
import { setToken } from './token.js';
import { resetUnauthorizedFlag } from './sessionEvents.js';

let pending = null;

export function refreshAccessToken() {
  if (!pending) {
    pending = axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then((response) => {
        const token = response.data?.data?.accessToken;
        if (!token) {
          throw new Error('Refresh did not return an access token');
        }
        setToken(token);
        resetUnauthorizedFlag();
        return token;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
