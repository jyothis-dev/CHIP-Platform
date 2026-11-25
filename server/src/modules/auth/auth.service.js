import crypto from 'node:crypto';
import { AppError } from '../../shared/errors.js';
import prisma from '../../shared/prisma.js';
import { verifyPassword } from '../../shared/password.js';
import { signAccessToken, verifyAccessToken } from '../../shared/tokens.js';
import { env } from '../../config/env.js';
import { logAudit } from '../../shared/audit.js';
import { ttlToMs } from '../../shared/duration.js';

export const REFRESH_COOKIE = 'chip_refresh';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: ttlToMs(env.refreshTokenTtl),
  };
}

export function setRefreshCookie(res, raw) {
  res.cookie(REFRESH_COOKIE, raw, refreshCookieOptions());
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(32).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ttlToMs(env.refreshTokenTtl)),
    },
  });
  return raw;
}

async function revokeActiveTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function login(input, ctx) {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await verifyPassword(user.passwordHash, input.password) : false;

  if (!user || !passwordOk) {
    await logAudit({
      actorId: user?.id ?? null,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user?.id ?? null,
      facilityId: user?.facilityId ?? null,
      outcome: 'denied',
      correlationId: ctx.requestId,
      message: user
        ? `Login denied for staff ${user.name}: invalid credentials.`
        : 'Login denied: invalid credentials.',
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const refreshToken = await issueRefreshToken(user.id);

  await logAudit({
    actorId: user.id,
    action: 'auth.login',
    resourceType: 'user',
    resourceId: user.id,
    facilityId: user.facilityId,
    outcome: 'success',
    correlationId: ctx.requestId,
    message: `Staff ${user.name} logged in successfully.`,
  });

  return {
    accessToken: signAccessToken({ userId: user.id }),
    expiresIn: env.accessTokenTtl,
    refreshToken,
    user: publicUser(user),
  };
}

export async function refresh(rawToken, ctx) {
  if (!rawToken) {
    await logAudit({
      action: 'auth.refresh',
      resourceType: 'user',
      outcome: 'denied',
      correlationId: ctx.requestId,
      message: 'Access denied: refresh token missing.',
    });
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });

  if (!row || !row.user) {
    await logAudit({
      action: 'auth.refresh',
      resourceType: 'user',
      outcome: 'denied',
      correlationId: ctx.requestId,
      message: 'Access denied: refresh token is not recognized.',
    });
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    await revokeActiveTokens(row.userId);
    await logAudit({
      actorId: row.userId,
      action: 'auth.refresh',
      resourceType: 'user',
      resourceId: row.userId,
      facilityId: row.user.facilityId,
      outcome: 'denied',
      correlationId: ctx.requestId,
      message: row.revokedAt
        ? `Access denied for staff ${row.user.name}: refresh token was already used.`
        : `Access denied for staff ${row.user.name}: refresh token expired.`,
    });
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count !== 1) {
    await revokeActiveTokens(row.userId);
    await logAudit({
      actorId: row.userId,
      action: 'auth.refresh',
      resourceType: 'user',
      resourceId: row.userId,
      facilityId: row.user.facilityId,
      outcome: 'denied',
      correlationId: ctx.requestId,
      message: `Access denied for staff ${row.user.name}: refresh token was already used.`,
    });
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  const refreshToken = await issueRefreshToken(row.userId);
  await logAudit({
    actorId: row.userId,
    action: 'auth.refresh',
    resourceType: 'user',
    resourceId: row.userId,
    facilityId: row.user.facilityId,
    outcome: 'success',
    correlationId: ctx.requestId,
    message: `Staff ${row.user.name} received a new access token.`,
  });

  return {
    accessToken: signAccessToken({ userId: row.userId }),
    expiresIn: env.accessTokenTtl,
    refreshToken,
  };
}

export async function logout(rawToken, headerToken, ctx) {
  let auth = null;
  if (headerToken) {
    try {
      const payload = verifyAccessToken(headerToken);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user) {
        auth = {
          userId: user.id,
          name: user.name,
          facilityId: user.facilityId,
        };
      }
    } catch {
      auth = null;
    }
  }

  if (rawToken) {
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (row) {
      await revokeActiveTokens(row.userId);
      auth = auth ?? { userId: row.userId, name: null, facilityId: null };
    }
  } else if (auth?.userId) {
    await revokeActiveTokens(auth.userId);
  }

  await logAudit({
    actorId: auth?.userId ?? null,
    action: 'auth.logout',
    resourceType: 'user',
    resourceId: auth?.userId ?? null,
    facilityId: auth?.facilityId ?? null,
    outcome: 'success',
    correlationId: ctx.requestId,
    message: auth?.name
      ? `Staff ${auth.name} logged out.`
      : 'Staff logged out.',
  });
}

export function sessionFromAuth(auth) {
  return {
    id: auth.userId,
    name: auth.name,
    email: auth.email,
    role: auth.role,
    accessTtl: env.accessTokenTtl,
  };
}
