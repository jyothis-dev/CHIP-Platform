import * as audit from '../modules/audit/audit.service.js';

export function requestAudit(req, res, next) {
  if (req.path === '/health') {
    next();
    return;
  }

  const started = Date.now();
  res.on('finish', () => {
    let outcome = 'success';
    if (res.statusCode === 401 || res.statusCode === 403) outcome = 'denied';
    else if (res.statusCode >= 400) outcome = 'error';

    audit.log({
      actorId: req.auth?.userId ?? null,
      hospitalId: req.auth?.hospitalId ?? null,
      action: 'http.request',
      entityType: 'http',
      outcome,
      requestId: req.id,
      ip: req.ip,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - started,
    });
  });
  next();
}
