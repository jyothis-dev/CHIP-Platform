import { AppError } from '../../shared/errors.js';
import prisma from '../../shared/prisma.js';
import { verifyPassword } from '../../shared/password.js';
import { signAccessToken } from '../../shared/tokens.js';
import { env } from '../../config/env.js';
import { logAudit } from '../../shared/audit.js';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
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
    user: publicUser(user),
  };
}

export async function logout(auth, ctx) {
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
