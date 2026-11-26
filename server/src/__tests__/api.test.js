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

const refreshRows = new Map();

function installRefreshStore() {
  prismaMock.refreshToken.create.mockImplementation(async ({ data }) => {
    const row = {
      id: `rt-${refreshRows.size + 1}`,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      user: {
        id: data.userId,
        name: 'Demo Staff',
        email: 'staff@example.com',
        role: 'STAFF',
        facilityId: '44444444-4444-4444-8444-444444444444',
      },
    };
    refreshRows.set(data.tokenHash, row);
    return row;
  });
  prismaMock.refreshToken.findUnique.mockImplementation(async ({ where }) => (
    refreshRows.get(where.tokenHash) ?? null
  ));
  prismaMock.refreshToken.updateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const row of refreshRows.values()) {
      if (where.id && row.id !== where.id) continue;
      if (where.userId && row.userId !== where.userId) continue;
      if (Object.hasOwn(where, 'revokedAt') && where.revokedAt === null && row.revokedAt) continue;
      Object.assign(row, data);
      count += 1;
    }
    return { count };
  });
}

function refreshCookie(res) {
  const header = res.headers['set-cookie'];
  const list = Array.isArray(header) ? header : (header ? [header] : []);
  const raw = list.find((item) => item.startsWith('chip_refresh='));
  return raw?.split(';')[0] ?? '';
}

describe('API', () => {
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Staffpass123', 12);
  });

  beforeEach(() => {
    refreshRows.clear();
    resetPrisma();
    installRefreshStore();
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
    expect(refreshCookie(res)).toMatch(/^chip_refresh=/);
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
    expect(JSON.stringify(res.body)).not.toContain(refreshCookie(res).split('=')[1]);
  });

  it('rotates the refresh cookie into a new access token and rejects reuse', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash,
      role: 'STAFF',
      facilityId: '44444444-4444-4444-8444-444444444444',
    });

    const loginRes = await request(app).post('/auth/login').send({
      email: 'staff@example.com',
      password: 'Staffpass123',
    });
    const firstCookie = refreshCookie(loginRes);

    const refreshed = await request(app).post('/auth/refresh').set('Cookie', firstCookie);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.data.refreshToken).toBeUndefined();
    expect(refreshCookie(refreshed)).not.toBe(firstCookie);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'auth.refresh',
        outcome: 'success',
        message: 'Staff Demo Staff received a new access token.',
      }),
    }));

    const reused = await request(app).post('/auth/refresh').set('Cookie', firstCookie);
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejects refresh when the cookie is missing', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('logout revokes the refresh cookie', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash,
      role: 'STAFF',
      facilityId: '44444444-4444-4444-8444-444444444444',
    });

    const loginRes = await request(app).post('/auth/login').send({
      email: 'staff@example.com',
      password: 'Staffpass123',
    });
    const cookie = refreshCookie(loginRes);
    const loggedOut = await request(app).post('/auth/logout').set('Cookie', cookie);

    expect(loggedOut.status).toBe(200);
    expect(loggedOut.body.data.loggedOut).toBe(true);
    expect(loggedOut.headers['set-cookie']?.[0]).toMatch(/chip_refresh=;/);

    const refreshed = await request(app).post('/auth/refresh').set('Cookie', cookie);
    expect(refreshed.status).toBe(401);
    expect(refreshed.body.code).toBe('UNAUTHENTICATED');
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
    expect(Object.keys(res.body.paths).sort()).toEqual([
      '/abha/enrolment/address',
      '/abha/enrolment/mobile/verify',
      '/abha/enrolment/otp',
      '/abha/enrolment/verify',
      '/abha/enrolment/{transactionId}/address-suggestions',
      '/abha/enrolment/{transactionId}/card',
      '/abha/traces',
      '/api/v3/consent/request/hip/notify',
      '/api/v3/hip/health-information/request',
      '/api/v3/hip/link/care-context/confirm',
      '/api/v3/hip/link/care-context/init',
      '/api/v3/hip/patient/care-context/discover',
      '/api/v3/hip/token/on-generate-token',
      '/api/v3/hiu/consent/on-fetch',
      '/api/v3/hiu/consent/request/notify',
      '/api/v3/hiu/consent/request/on-init',
      '/api/v3/hiu/consent/request/on-status',
      '/api/v3/hiu/health-information/on-request',
      '/api/v3/hiu/health-information/transfer',
      '/api/v3/link/on_carecontext',
      '/api/v3/links/context/on-notify',
      '/api/v3/patients/sms/on-notify',
      '/audit',
      '/auth/login',
      '/auth/logout',
      '/auth/me',
      '/auth/refresh',
      '/health',
      '/hip/bridge/url',
      '/hip/bundles/inspect',
      '/hip/exchanges',
      '/hip/patients/{id}/records',
      '/hip/readiness',
      '/hiu/artefacts/{id}/fetch',
      '/hiu/artefacts/{id}/health-information',
      '/hiu/artefacts/{id}/records',
      '/hiu/consent-requests',
      '/hiu/consent-requests/{id}',
      '/hiu/consent-requests/{id}/status',
      '/hiu/health-information/{id}/status',
      '/hiu/options',
      '/hiu/readiness',
      '/patients',
      '/patients/{id}',
      '/patients/{id}/abha',
      '/registries/facilities/{id}/bridge-link',
      '/registries/facilities/{id}/bridge-status',
      '/registries/facilities/{id}/hfr-link',
      '/registries/facility',
      '/registries/hfr/masters/{kind}',
      '/registries/hfr/search',
      '/registries/hpr/exists/{hprId}',
      '/registries/hpr/professional-info',
      '/registries/hpr/search-by-mobile',
      '/registries/hpr/{hprId}',
      '/registries/options',
      '/registries/practitioners/{id}/hpr-link',
      '/registries/readiness',
    ]);
    expect(res.body.paths['/auth/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(res.body.paths['/auth/login'].post.security).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);
  });
});
