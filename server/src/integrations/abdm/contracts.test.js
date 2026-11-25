import { jest } from '@jest/globals';

describe('ABDM contracts', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.LOG_LEVEL = 'silent';
    process.env.ABDM_GATEWAY_BASE_URL = '';
    process.env.ABDM_ABHA_BASE_URL = '';
    process.env.ABDM_SANDBOX_HOST_ALLOWLIST = '';
    process.env.ABDM_BENEFIT_NAME = '';
    process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');
  });

  it('returns POST /api/hiecm/gateway/v3/sessions for session', async () => {
    const { getContract } = await import('./contracts.js');
    const session = getContract('session');
    expect(session.method).toBe('POST');
    expect(session.path).toBe('/api/hiecm/gateway/v3/sessions');
    expect(session.verifiedOn).toBeTruthy();
  });

  it('includes BENEFIT_NAME on enrolByAadhaar only when ABDM_BENEFIT_NAME is set', async () => {
    process.env.ABDM_BENEFIT_NAME = '';
    jest.resetModules();
    {
      const { getContract } = await import('./contracts.js');
      expect(getContract('enrolByAadhaar').headers).not.toContain('BENEFIT_NAME');
      expect(getContract('enrolByAadhaar').benefitName).toBeNull();
    }

    process.env.ABDM_BENEFIT_NAME = 'WombTo18-CHIP';
    jest.resetModules();
    {
      const { getContract } = await import('./contracts.js');
      expect(getContract('enrolByAadhaar').headers).toContain('BENEFIT_NAME');
      expect(getContract('enrolByAadhaar').benefitName).toBe('WombTo18-CHIP');
    }
  });

  it('throws 412 CONTRACT_UNVERIFIED when verifiedOn is missing', async () => {
    const { assertContractVerified } = await import('./contracts.js');
    expect(() => assertContractVerified({ path: '/x' }, 'draft')).toThrow(/not verified/);
    try {
      assertContractVerified({ path: '/x' }, 'draft');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBe(412);
      expect(err.code).toBe('CONTRACT_UNVERIFIED');
    }
  });
});
