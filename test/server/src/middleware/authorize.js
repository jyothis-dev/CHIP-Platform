import { AppError } from '../shared/errors.js';
import * as audit from '../modules/audit/audit.service.js';

export function authorize(...keys) {
  return async (req, _res, next) => {
    try {
      const granted = req.auth?.permissions ?? [];
      const missing = keys.filter((key) => !granted.includes(key));
      if (missing.length > 0) {
        await audit.log({
          actorId: req.auth?.userId ?? null,
          hospitalId: req.auth?.hospitalId ?? null,
          action: 'auth.permission_denied',
          entityType: 'permission',
          entityId: missing[0],
          outcome: 'denied',
          requestId: req.id,
          ip: req.ip,
          method: req.method,
          path: req.path,
        });
        throw new AppError(403, 'PERMISSION_DENIED', 'You do not have permission for this action');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
