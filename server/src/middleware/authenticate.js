import { AppError } from '../shared/errors.js';
import prisma from '../shared/prisma.js';
import { verifyAccessToken } from '../shared/tokens.js';
import { logAudit } from '../shared/audit.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      await logAudit({
        action: 'auth.access',
        resourceType: 'user',
        outcome: 'denied',
        correlationId: req.id,
        message: 'Access denied: authentication required.',
      });
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      await logAudit({
        action: 'auth.access',
        resourceType: 'user',
        outcome: 'denied',
        correlationId: req.id,
        message: 'Access denied: invalid or expired access token.',
      });
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required', { cause: err });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      await logAudit({
        actorId: payload.sub,
        action: 'auth.access',
        resourceType: 'user',
        resourceId: payload.sub,
        outcome: 'denied',
        correlationId: req.id,
        message: 'Access denied: staff account no longer exists.',
      });
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    req.auth = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      facilityId: user.facilityId,
    };
    next();
  } catch (err) {
    next(err);
  }
}
