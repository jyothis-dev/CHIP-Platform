import * as authService from './auth.service.js';

export async function login(req, res) {
  const data = await authService.login(req.validated.body, {
    requestId: req.id,
    ip: req.ip,
  });
  res.json({ success: true, data });
}

export async function logout(req, res) {
  await authService.logout(req.auth, {
    requestId: req.id,
    ip: req.ip,
  });
  res.json({ success: true, data: { loggedOut: true } });
}

export function me(req, res) {
  res.json({ success: true, data: authService.sessionFromAuth(req.auth) });
}
