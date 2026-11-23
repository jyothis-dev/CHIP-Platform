import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';

function limitHandler(req, _res, next) {
  const reset = req.rateLimit?.resetTime;
  const retryAfter = reset ? Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 1000)) : 60;
  logger.warn(
    { component: 'http', requestId: req.id, path: req.path, method: req.method },
    'rate limit exceeded',
  );
  next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.', { retryAfter }));
}

export function buildLimiter({ windowMs, max, keyGenerator, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator,
    handler: limitHandler,
    validate: { keyGeneratorIpFallback: false },
  });
}

const fifteenMinutes = 15 * 60 * 1000;

export const loginIpLimiter = buildLimiter({
  windowMs: fifteenMinutes,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

export const loginEmailLimiter = buildLimiter({
  windowMs: fifteenMinutes,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return email ? `email:${email}` : ipKeyGenerator(req.ip);
  },
});

export const sessionLimiter = buildLimiter({
  windowMs: fifteenMinutes,
  max: 30,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});
