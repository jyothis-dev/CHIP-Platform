import * as authService from './auth.service.js';

export async function login(req, res) {
  const data = await authService.login(req.validated.body, {
    requestId: req.id,
    ip: req.ip,
  });
  authService.setRefreshCookie(res, data.refreshToken);
  res.json({
    success: true,
    data: {
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
      user: data.user,
    },
  });
}

export async function refresh(req, res) {
  const data = await authService.refresh(req.cookies?.[authService.REFRESH_COOKIE], {
    requestId: req.id,
    ip: req.ip,
  });
  authService.setRefreshCookie(res, data.refreshToken);
  res.json({
    success: true,
    data: {
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
    },
  });
}

export async function logout(req, res) {
  const header = req.get('authorization');
  const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
  await authService.logout(req.cookies?.[authService.REFRESH_COOKIE], headerToken, {
    requestId: req.id,
    ip: req.ip,
  });
  authService.clearRefreshCookie(res);
  res.json({ success: true, data: { loggedOut: true } });
}

export function me(req, res) {
  res.json({ success: true, data: authService.sessionFromAuth(req.auth) });
}
