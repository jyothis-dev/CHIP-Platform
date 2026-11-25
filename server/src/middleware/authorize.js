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
          facilityId: req.auth?.facilityId ?? null,
          outcome: 'denied',
          correlationId: req.id,
          message: req.auth?.name
            ? `Permission denied for staff ${req.auth.name} (${role || 'unknown role'}).`
            : 'Permission denied for this action.',
        });
        throw new AppError(403, 'PERMISSION_DENIED', 'You do not have permission for this action');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
