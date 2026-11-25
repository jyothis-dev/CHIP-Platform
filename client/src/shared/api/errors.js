export class ApiError extends Error {
  constructor({ message, status, code, details }) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || null;
  }
}

export function toApiError(error) {
  if (error instanceof ApiError) return error;
  const response = error?.response;
  const payload = response?.data || {};
  return new ApiError({
    message: payload.message || error.message || 'Request failed',
    status: response?.status ?? 0,
    code: payload.code,
    details: payload.details || null,
  });
}

export function fieldErrorsFromDetails(details) {
  if (!Array.isArray(details)) return {};
  const fields = {};
  for (const item of details) {
    const path = String(item.path || '').replace(/^body\./, '');
    if (path) fields[path] = item.message;
  }
  return fields;
}
