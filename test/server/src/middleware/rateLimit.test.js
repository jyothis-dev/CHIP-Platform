import express from 'express';
import request from 'supertest';
import { buildLimiter } from './rateLimit.js';
import { errorHandler } from './errorHandler.js';

let key = 0;

function buildApp() {
  const bucket = `login-${key += 1}`;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.id = 'req-limit';
    next();
  });
  app.post(
    '/auth/login',
    buildLimiter({
      windowMs: 60_000,
      max: 1,
      skipSuccessfulRequests: true,
      keyGenerator: () => bucket,
    }),
    (req, res) => {
      if (req.body.password !== 'correct-password') {
        res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
        return;
      }
      res.json({ success: true });
    },
  );
  app.use(errorHandler);
  return app;
}

describe('auth rate limit', () => {
  it('returns 429 after the failed-attempt limit', async () => {
    const app = buildApp();
    const first = await request(app).post('/auth/login').send({ password: 'wrong-password' });
    expect(first.status).toBe(401);

    const second = await request(app).post('/auth/login').send({ password: 'wrong-password' });
    expect(second.status).toBe(429);
    expect(second.body.code).toBe('RATE_LIMITED');
    expect(second.headers['retry-after']).toBeDefined();
    expect(JSON.stringify(second.body)).not.toContain('wrong-password');
  });

  it('does not count a successful login', async () => {
    const app = buildApp();
    const ok = await request(app).post('/auth/login').send({ password: 'correct-password' });
    expect(ok.status).toBe(200);
    const failed = await request(app).post('/auth/login').send({ password: 'wrong-password' });
    expect(failed.status).toBe(401);
  });
});
