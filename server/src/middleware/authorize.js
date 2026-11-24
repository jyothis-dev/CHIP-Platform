import { AppError } from '../shared/errors.js';
import { logAudit } from '../shared/audit.js';

export function authorize(...roles) {
  return async (req, _res, next) => {
    try {
      const role = req.auth?.role;
      if (!role || !roles.includes(role)) {
        await logAudit({
          actorId: req.auth?.userId ?? null,
          action: 'auth.permission_denied',
          resourceType: 'user',
          resourceId: req.auth?.userId ?? null,
          outcome: 'denied',
          correlationId: req.id,
        });
        throw new AppError(403, 'PERMISSION_DENIED', 'You do not have permission for this action');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
