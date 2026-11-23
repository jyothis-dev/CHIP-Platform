import { AppError } from '../shared/errors.js';
import prisma from '../shared/prisma.js';
import { verifyAccessToken } from '../shared/tokens.js';
import * as audit from '../modules/audit/audit.service.js';

const membershipInclude = {
  user: { include: { profile: true } },
  role: { include: { permissions: { include: { permission: true } } } },
  hospital: true,
  department: true,
};

export async function authenticate(req, _res, next) {
  try {
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      await audit.log({
        action: 'auth.access',
        entityType: 'user',
        outcome: 'denied',
        requestId: req.id,
        ip: req.ip,
        method: req.method,
        path: req.path,
      });
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      await audit.log({
        action: 'auth.access',
        entityType: 'user',
        outcome: 'denied',
        requestId: req.id,
        ip: req.ip,
        method: req.method,
        path: req.path,
      });
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required', { cause: err });
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: payload.sub,
        hospitalId: payload.hospitalId,
        status: 'active',
        user: { status: 'active' },
      },
      include: membershipInclude,
    });

    if (!membership) {
      await audit.log({
        actorId: payload.sub,
        hospitalId: payload.hospitalId,
        action: 'auth.access',
        entityType: 'user',
        entityId: payload.sub,
        outcome: 'denied',
        requestId: req.id,
        ip: req.ip,
      });
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    req.auth = {
      userId: membership.user.id,
      email: membership.user.email,
      hospitalId: membership.hospitalId,
      roleId: membership.roleId,
      departmentId: membership.departmentId,
      permissions: membership.role.permissions.map((item) => item.permission.key),
      profile: membership.user.profile,
      hospital: {
        id: membership.hospital.id,
        name: membership.hospital.name,
        code: membership.hospital.code,
      },
      department: membership.department
        ? { id: membership.department.id, name: membership.department.name, code: membership.department.code }
        : null,
      role: { id: membership.role.id, name: membership.role.name },
    };
    next();
  } catch (err) {
    next(err);
  }
}
