import { REFRESH_COOKIE, refreshCookieOptions } from '../../shared/cookies.js';
import * as authService from './auth.service.js';

function sendSession(res, result, status = 200) {
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  const { refreshToken, ...data } = result;
  res.status(status).json({ success: true, data });
}

export async function login(req, res) {
  const result = await authService.login(req.validated.body, {
    requestId: req.id,
    ip: req.ip,
  });
  sendSession(res, result);
}

export async function refresh(req, res) {
  const result = await authService.refresh(req.cookies?.[REFRESH_COOKIE], {
    requestId: req.id,
    ip: req.ip,
  });
  sendSession(res, result);
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE], {
    requestId: req.id,
    ip: req.ip,
  });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.json({ success: true, data: { loggedOut: true } });
}

export async function switchHospital(req, res) {
  const result = await authService.switchHospital(
    req.auth,
    req.validated.body.hospitalId,
    req.cookies?.[REFRESH_COOKIE],
    { requestId: req.id, ip: req.ip },
  );
  sendSession(res, result);
}

export function me(req, res) {
  res.json({ success: true, data: authService.sessionFromAuth(req.auth) });
}
