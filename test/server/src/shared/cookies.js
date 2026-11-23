import { env } from '../config/env.js';

export const REFRESH_COOKIE = 'refresh_token';

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000,
  };
}
