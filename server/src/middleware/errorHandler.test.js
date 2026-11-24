import express from 'express';
import request from 'supertest';
import { AppError } from '../shared/errors.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { errorHandler } from './errorHandler.js';

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.id = 'req-1';
    next();
  });
  app.get('/missing', () => {
    throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
  });
  app.get('/invalid', asyncHandler(async () => {
    throw new AppError(400, 'VALIDATION_ERROR', 'body.firstName: Required', {
      details: [{ path: 'body.firstName', message: 'Required' }],
    });
  }));
  app.get('/conflict', () => {
    const err = new Error('unique');
    err.code = 'P2002';
    throw err;
  });
  app.get('/boom', () => {
    throw new Error('database password leaked');
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const app = buildApp();

  it('returns the application error code', async () => {
    const res = await request(app).get('/missing');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      code: 'CHILD_NOT_FOUND',
      message: 'Child not found',
      requestId: 'req-1',
    });
    expect(res.body.stack).toBeUndefined();
  });

  it('keeps validation details on a 400', async () => {
    const res = await request(app).get('/invalid');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toEqual([{ path: 'body.firstName', message: 'Required' }]);
  });

  it('maps a unique constraint to 409', async () => {
    const res = await request(app).get('/conflict');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('hides unexpected errors', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});
