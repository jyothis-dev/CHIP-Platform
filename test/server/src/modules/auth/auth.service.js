import { AppError } from '../../shared/errors.js';
import prisma from '../../shared/prisma.js';
import bcrypt from 'bcrypt';
import {
  hashRefreshToken,
  newRefreshToken,
  refreshExpiry,
  signAccessToken,
} from '../../shared/tokens.js';
import { env } from '../../config/env.js';
import * as audit from '../audit/audit.service.js';

const membershipInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
  hospital: true,
  department: true,
};

function publicSession(user, membership) {
  return {
    id: user.id,
    email: user.email,
    profile: user.profile
      ? {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          phone: user.profile.phone,
          designation: user.profile.designation,
        }
      : null,
    hospital: {
      id: membership.hospital.id,
      name: membership.hospital.name,
      code: membership.hospital.code,
    },
    department: membership.department
      ? { id: membership.department.id, name: membership.department.name, code: membership.department.code }
      : null,
    role: { id: membership.role.id, name: membership.role.name },
    permissions: membership.role.permissions.map((item) => item.permission.key),
  };
}

function accessPayload(user, membership, refreshToken) {
  return {
    accessToken: signAccessToken({ userId: user.id, hospitalId: membership.hospitalId }),
    expiresIn: 15 * 60,
    refreshToken,
    user: publicSession(user, membership),
  };
}

async function issueRefreshToken(userId, hospitalId) {
  const { token, tokenHash } = newRefreshToken();
  const record = await prisma.refreshToken.create({
    data: {
      userId,
      hospitalId,
      tokenHash,
      expiresAt: refreshExpiry(),
    },
  });
  return { token, id: record.id };
}

export async function login(input, ctx) {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
      memberships: { where: { status: 'active' }, include: membershipInclude },
    },
  });

  const passwordOk = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !passwordOk || user.status !== 'active') {
    await audit.log({
      actorId: user?.id ?? null,
      action: 'auth.login',
      entityType: 'user',
      entityId: user?.id ?? null,
      outcome: 'denied',
      requestId: ctx.requestId,
      ip: ctx.ip,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const memberships = user.memberships;
  if (memberships.length === 0) {
    throw new AppError(403, 'NO_MEMBERSHIP', 'No hospital membership');
  }
  if (!input.hospitalId && memberships.length > 1) {
    throw new AppError(400, 'HOSPITAL_REQUIRED', 'Choose a hospital');
  }

  const membership = input.hospitalId
    ? memberships.find((item) => item.hospitalId === input.hospitalId)
    : memberships[0];
  if (!membership) {
    throw new AppError(403, 'HOSPITAL_FORBIDDEN', 'You are not a member of that hospital');
  }

  const refresh = await issueRefreshToken(user.id, membership.hospitalId);
  await audit.log({
    actorId: user.id,
    hospitalId: membership.hospitalId,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });

  return accessPayload(user, membership, refresh.token);
}

export async function refresh(rawToken, ctx) {
  if (!rawToken) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token is missing');
  }

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
  });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    await audit.log({
      actorId: existing?.userId ?? null,
      hospitalId: existing?.hospitalId ?? null,
      action: 'auth.refresh',
      entityType: 'user',
      entityId: existing?.userId ?? null,
      outcome: 'denied',
      requestId: ctx.requestId,
      ip: ctx.ip,
    });
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token is invalid');
  }

  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    include: { profile: true },
  });
  const membership = await prisma.membership.findFirst({
    where: { userId: existing.userId, hospitalId: existing.hospitalId, status: 'active' },
    include: membershipInclude,
  });
  if (!user || user.status !== 'active' || !membership) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Refresh token is invalid');
  }

  const nextToken = await issueRefreshToken(user.id, membership.hospitalId);
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedById: nextToken.id },
  });

  await audit.log({
    actorId: user.id,
    hospitalId: membership.hospitalId,
    action: 'auth.refresh',
    entityType: 'user',
    entityId: user.id,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });

  return accessPayload(user, membership, nextToken.token);
}

export async function logout(rawToken, ctx) {
  if (rawToken) {
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
    });
    if (existing && !existing.revokedAt) {
      await prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      await audit.log({
        actorId: existing.userId,
        hospitalId: existing.hospitalId,
        action: 'auth.logout',
        entityType: 'user',
        entityId: existing.userId,
        outcome: 'success',
        requestId: ctx.requestId,
        ip: ctx.ip,
      });
    }
  }
}

export async function switchHospital(auth, hospitalId, rawToken, ctx) {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { profile: true },
  });
  const membership = await prisma.membership.findFirst({
    where: { userId: auth.userId, hospitalId, status: 'active' },
    include: membershipInclude,
  });
  if (!user || !membership) {
    throw new AppError(403, 'HOSPITAL_FORBIDDEN', 'You are not a member of that hospital');
  }

  const nextToken = await issueRefreshToken(user.id, membership.hospitalId);
  if (rawToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date(), replacedById: nextToken.id },
    });
  }

  await audit.log({
    actorId: user.id,
    hospitalId: membership.hospitalId,
    action: 'auth.switch_hospital',
    entityType: 'hospital',
    entityId: membership.hospitalId,
    outcome: 'success',
    requestId: ctx.requestId,
    ip: ctx.ip,
  });

  return accessPayload(user, membership, nextToken.token);
}

export function sessionFromAuth(auth) {
  return {
    id: auth.userId,
    email: auth.email,
    profile: auth.profile,
    hospital: auth.hospital,
    department: auth.department,
    role: auth.role,
    permissions: auth.permissions,
    accessTtl: env.accessTokenTtl,
  };
}
