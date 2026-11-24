import { logger } from '../shared/logger.js';

export function requestLogger(req, res, next) {
  if (req.path === '/health') {
    next();
    return;
  }

  const started = Date.now();
  res.on('finish', () => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      {
        component: 'http',
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - started,
        userId: req.auth?.userId,
      },
      'request completed',
    );
  });
  next();
}
