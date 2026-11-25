import { jest } from '@jest/globals';

const mockRequest = jest.fn();
const logLines = [];
const traceCreates = [];

jest.unstable_mockModule('../../shared/prisma.js', () => ({
  default: {
    abdmTrace: {
      create: jest.fn(async ({ data }) => {
        traceCreates.push(data);
        return { id: 'trace-1', ...data };
      }),
    },
  },
}));

jest.unstable_mockModule('../../shared/logger.js', () => ({
  logger: {
    info: (obj) => { logLines.push(obj); },
    error: (obj) => { logLines.push(obj); },
    warn: (obj) => { logLines.push(obj); },
  },
  redact: { paths: [], censor: '[REDACTED]' },
}));

describe('abdmRequest', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRequest.mockReset();
    logLines.length = 0;
    traceCreates.length = 0;
    process.env.ABDM_TRACE = 'false';
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.LOG_LEVEL = 'silent';
    process.env.ABDM_CLIENT_ID = 'test-client';
    process.env.ABDM_CLIENT_SECRET = 'test-secret';
    process.env.ABDM_CM_ID = 'sbx';
    process.env.ABDM_GATEWAY_BASE_URL = 'https://dev.abdm.gov.in';
    process.env.ABDM_ABHA_BASE_URL = 'https://abhasbx.abdm.gov.in';
    process.env.ABDM_HFR_BASE_URL = '';
    process.env.ABDM_HPR_BASE_URL = '';
    process.env.ABDM_SANDBOX_HOST_ALLOWLIST = 'dev.abdm.gov.in,abhasbx.abdm.gov.in';
    process.env.ABDM_BENEFIT_NAME = '';
    process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');
  });

  async function load() {
    const session = await import('./session.js');
    session.clearGatewayTokenCache();
    const client = await import('./client.js');
    const { getContract } = await import('./contracts.js');
    return { ...client, getContract };
  }

  it('refreshes the gateway token once on 401, then fails on a second 401', async () => {
    mockRequest
      .mockResolvedValueOnce({ status: 200, data: { accessToken: 'token-a', expiresIn: 1200 } })
      .mockResolvedValueOnce({ status: 401, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { accessToken: 'token-b', expiresIn: 1200 } })
      .mockResolvedValueOnce({ status: 401, data: {} });

    const { abdmRequest, getContract } = await load();
    const contract = getContract('certificate');
    const http = { request: mockRequest };

    await expect(abdmRequest({ contract, http })).rejects.toMatchObject({
      statusCode: 502,
      code: 'ABDM_UNAUTHORIZED',
    });

    expect(mockRequest).toHaveBeenCalledTimes(4);
  });

  it('omits clientSecret and accessToken from log objects', async () => {
    mockRequest
      .mockResolvedValueOnce({ status: 200, data: { accessToken: 'secret-token', expiresIn: 1200 } })
      .mockResolvedValueOnce({
        status: 200,
        data: { publicKey: 'abc', encryptionAlgorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding' },
      });

    const { abdmRequest, getContract } = await load();
    await abdmRequest({ contract: getContract('certificate'), http: { request: mockRequest } });

    const dumped = JSON.stringify(logLines);
    expect(dumped).not.toContain('test-secret');
    expect(dumped).not.toContain('secret-token');
    expect(dumped).not.toContain('clientSecret');
    expect(dumped).not.toContain('accessToken');
  });

  it('sends a UTC TIMESTAMP with milliseconds and Z', async () => {
    mockRequest
      .mockResolvedValueOnce({ status: 200, data: { accessToken: 'token-c', expiresIn: 1200 } })
      .mockResolvedValueOnce({ status: 200, data: {} });

    const { abdmRequest, getContract } = await load();
    await abdmRequest({ contract: getContract('certificate'), http: { request: mockRequest } });

    const certCall = mockRequest.mock.calls[1][0];
    expect(certCall.headers.TIMESTAMP).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(certCall.headers['REQUEST-ID']).toEqual(expect.any(String));
  });

  it('stores a redacted request and response when tracing is on', async () => {
    process.env.ABDM_TRACE = 'true';
    mockRequest
      .mockResolvedValueOnce({ status: 200, data: { accessToken: 'secret-token', expiresIn: 1200 } })
      .mockResolvedValueOnce({
        status: 400,
        data: { message: 'Invalid LoginId', loginId: 'should-hide' },
      });

    const { abdmRequest, getContract } = await load();
    const result = await abdmRequest({
      contract: getContract('requestAadhaarOtp'),
      body: { loginId: 'encrypted-aadhaar', scope: ['abha-enrol'] },
      http: { request: mockRequest },
    });

    expect(result.status).toBe(400);
    expect(traceCreates).toHaveLength(1);
    expect(traceCreates[0].path).toBe('/abha/api/v3/enrollment/request/otp');
    expect(traceCreates[0].requestBody.loginId).toBe('[REDACTED]');
    expect(traceCreates[0].requestBody.scope).toEqual(['abha-enrol']);
    expect(traceCreates[0].responseBody.loginId).toBe('[REDACTED]');
    expect(traceCreates[0].responseBody.message).toBe('Invalid LoginId');
    expect(JSON.stringify(traceCreates)).not.toContain('encrypted-aadhaar');
    expect(JSON.stringify(traceCreates)).not.toContain('secret-token');
  });
});
