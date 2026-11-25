import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prismaMock, resetPrisma } from '../../test/prismaMock.js';

const userId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';

jest.unstable_mockModule('../../shared/prisma.js', () => ({
  default: prismaMock,
}));

process.env.NODE_ENV = 'test';
process.env.ABDM_TRACE = 'true';
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

describe('ABHA traffic when tracing is on', () => {
  let token;

  beforeAll(async () => {
    await bcrypt.hash('Staffpass123', 12);
    token = signAccessToken({ userId });
  });

  beforeEach(() => {
    resetPrisma();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash: 'hash',
      role: 'STAFF',
      facilityId,
    });
  });

  it('returns the newest redacted ABHA calls', async () => {
    prismaMock.abdmTrace.findMany.mockResolvedValue([{
      id: 'trace-1',
      method: 'POST',
      path: '/abha/api/v3/enrollment/request/otp',
      requestId: 'req-1',
      status: 400,
      latencyMs: 220,
      requestBody: { loginId: '[REDACTED]' },
      responseBody: { message: 'Invalid LoginId' },
      errorMessage: null,
      createdAt: new Date('2026-11-25T00:00:00.000Z'),
    }]);

    const res = await request(app)
      .get('/abha/traces')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe(400);
    expect(res.body.data[0].responseBody.message).toBe('Invalid LoginId');
    expect(prismaMock.abdmTrace.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }));
  });
});
