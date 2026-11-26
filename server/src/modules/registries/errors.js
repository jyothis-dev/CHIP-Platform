import { AppError } from '../../shared/errors.js';

const MESSAGE_LIMIT = 300;

/**
 * The M4 specifications return no error code. Failures arrive as a plain string body or as
 * a small object, so read both and never assume a shape.
 */
export function registryMessage(body) {
  if (body == null || body === '') return null;
  if (typeof body === 'string') return body.trim().slice(0, MESSAGE_LIMIT) || null;
  const first = Array.isArray(body) ? body[0] : body;
  if (typeof first === 'string') return first.trim().slice(0, MESSAGE_LIMIT) || null;
  const raw = first?.error?.message || first?.message || first?.description || first?.error || '';
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text ? text.slice(0, MESSAGE_LIMIT) : null;
}

export function isOk(result) {
  return result.status >= 200 && result.status < 300;
}

/** Map a refused registry call to an AppError. Never carries the raw body. */
export function registryFailure(result, { notFoundMessage = 'Not found in the registry' } = {}) {
  const message = registryMessage(result.body);
  const details = { httpStatus: result.status, abdmMessage: message };
  if (result.status === 404) {
    return new AppError(404, 'REGISTRY_NOT_FOUND', notFoundMessage, { details });
  }
  if (result.status === 400 || result.status === 422) {
    const code = /hip\s*name|hipname/i.test(message || '') ? 'HIP_NAME_REFUSED' : 'REGISTRY_VALIDATION';
    return new AppError(400, code, message || 'The registry refused the request', { details });
  }
  if (result.status === 403) {
    return new AppError(502, 'REGISTRY_FORBIDDEN', message || 'The registry refused this client', { details });
  }
  return new AppError(502, 'ABDM_UPSTREAM', message || 'The registry could not complete the request', { details });
}
