import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prismaMock, resetPrisma } from '../../test/prismaMock.js';

const userId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';
const otherFacilityId = '55555555-5555-4555-8555-555555555555';

jest.unstable_mockModule('../../shared/prisma.js', () => ({
  default: prismaMock,
}));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.ABDM_GATEWAY_BASE_URL = '';
process.env.ABDM_ABHA_BASE_URL = '';
process.env.ABDM_SANDBOX_HOST_ALLOWLIST = '';
process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');

const { default: app } = await import('../../app.js');
const { signAccessToken } = await import('../../shared/tokens.js');

describe('audit routes', () => {
  let passwordHash;
  let token;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Staffpass123', 12);
    token = signAccessToken({ userId });
  });

  beforeEach(() => {
    resetPrisma();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash,
      role: 'STAFF',
      facilityId,
    });
  });

  it('returns 401 without a bearer token', async () => {
    const res = await request(app).get('/audit');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('lists facility audit rows including message', async () => {
    prismaMock.auditLog.count.mockResolvedValue(1);
    prismaMock.auditLog.findMany.mockResolvedValue([{
      id: 'audit-1',
      action: 'auth.login',
      resourceType: 'user',
      resourceId: userId,
      facilityId,
      outcome: 'success',
      message: 'Staff Demo Staff logged in successfully.',
      correlationId: 'corr-1',
      createdAt: new Date('2026-11-25T10:00:00.000Z'),
      actor: { id: userId, name: 'Demo Staff', role: 'STAFF' },
    }]);

    const res = await request(app)
      .get('/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].message).toBe('Staff Demo Staff logged in successfully.');
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ facilityId }),
      skip: 0,
      take: 20,
    }));
  });

  it('applies action and outcome filters', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/audit')
      .query({ action: 'patient.create', outcome: 'success', page: '2', pageSize: '10' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        facilityId,
        action: 'patient.create',
        outcome: 'success',
      }),
      skip: 10,
      take: 10,
    }));
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ facilityId: otherFacilityId }),
    }));
  });

  it('returns 400 when the page is not a positive integer', async () => {
    const res = await request(app)
      .get('/audit')
      .query({ page: '0' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
  });
});
