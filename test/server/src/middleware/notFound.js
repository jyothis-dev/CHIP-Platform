import { AppError } from '../shared/errors.js';

export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
}
