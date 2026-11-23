import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

export function errorHandler(err, req, res, _next) {
  let status = err.statusCode ?? 500;
  let code = err.code ?? 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  const details = err.details;

  if (err instanceof SyntaxError && Object.hasOwn(err, 'body')) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body must be JSON';
  } else if (err.code === 'P2002') {
    status = 409;
    code = 'CONFLICT';
    message = 'This record already exists';
  }

  if (status >= 500) {
    logger.error({ err, component: 'http', requestId: req.id, code }, 'request failed');
    message = 'Something went wrong';
  } else {
    logger.warn({ component: 'http', requestId: req.id, code, status }, 'request rejected');
  }

  if (err.retryAfter) {
    res.setHeader('Retry-After', String(err.retryAfter));
  }

  const body = { success: false, code, message, requestId: req.id };
  if (details) body.details = details;
  res.status(status).json(body);
}
