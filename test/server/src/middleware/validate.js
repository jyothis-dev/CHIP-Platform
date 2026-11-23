import { AppError } from '../shared/errors.js';

export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    });
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      const message = details.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
      next(new AppError(400, 'VALIDATION_ERROR', message, { details }));
      return;
    }
    req.validated = parsed.data;
    next();
  };
}
