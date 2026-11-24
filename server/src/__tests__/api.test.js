import '../test/env.js';
import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prismaMock, resetPrisma } from '../test/prismaMock.js';

jest.unstable_mockModule('../shared/prisma.js', () => ({
  default: prismaMock,
}));

const { default: app } = await import('../app.js');

const userId = '33333333-3333-4333-8333-333333333333';

describe('API', () => {
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Staffpass123', 12);
  });

  beforeEach(() => {
    resetPrisma();
  });

  it('reports the database connection on the health check', async () => {
    prismaMock.$queryRaw.mockResolvedValue([1]);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'OK', database: 'up' });
  });

  it('returns 503 when the database is unreachable', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("Can't reach database server at secret-host"));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.message).toBe('Database is unreachable');
    expect(JSON.stringify(res.body)).not.toContain('secret-host');
  });

  it('logs in and returns an access token without a password hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash,
      role: 'STAFF',
      facilityId: '44444444-4444-4444-8444-444444444444',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'staff@example.com',
      password: 'Staffpass123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      id: userId,
      email: 'staff@example.com',
      role: 'STAFF',
    });
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
  });

  it('rejects a wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash,
      role: 'STAFF',
      facilityId: '44444444-4444-4444-8444-444444444444',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'staff@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
  });

  it('serves the OpenAPI document for the routes that exist', async () => {
    const res = await request(app).get('/api-docs/openapi.json');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths).sort()).toEqual(['/auth/login', '/auth/logout', '/auth/me', '/health']);
    expect(res.body.paths['/auth/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(res.body.paths['/auth/login'].post.security).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);
  });
});
