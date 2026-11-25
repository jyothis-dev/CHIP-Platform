import { jest } from '@jest/globals';

const mockRequest = jest.fn();

describe('gateway session', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRequest.mockReset();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.LOG_LEVEL = 'silent';
    process.env.ABDM_CLIENT_ID = 'test-client';
    process.env.ABDM_CLIENT_SECRET = 'test-secret';
    process.env.ABDM_CM_ID = 'sbx';
    process.env.ABDM_GATEWAY_BASE_URL = 'https://dev.abdm.gov.in';
    process.env.ABDM_ABHA_BASE_URL = '';
    process.env.ABDM_HFR_BASE_URL = '';
    process.env.ABDM_HPR_BASE_URL = '';
    process.env.ABDM_SANDBOX_HOST_ALLOWLIST = 'dev.abdm.gov.in,abhasbx.abdm.gov.in';
    process.env.ABDM_BENEFIT_NAME = '';
    process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');
  });

  async function loadSession() {
    const session = await import('./session.js');
    session.clearGatewayTokenCache();
    return session;
  }

  it('posts client credentials with REQUEST-ID, TIMESTAMP, X-CM-ID and no Authorization', async () => {
    mockRequest.mockResolvedValueOnce({
      status: 200,
      data: { accessToken: 'gw-token-1', expiresIn: 1200 },
    });

    const { getGatewayToken } = await loadSession();
    const result = await getGatewayToken({ http: { request: mockRequest } });

    expect(result.accessToken).toBe('gw-token-1');
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions');
    expect(call.headers.Authorization).toBeUndefined();
    expect(call.headers['X-CM-ID']).toBe('sbx');
    expect(call.headers['REQUEST-ID']).toEqual(expect.any(String));
    expect(call.headers.TIMESTAMP).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(call.data).toEqual({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      grantType: 'client_credentials',
    });
  });

  it('reuses the cached token within expiresIn', async () => {
    mockRequest.mockResolvedValueOnce({
      status: 200,
      data: { accessToken: 'gw-token-2', expiresIn: 1200 },
    });

    const { getGatewayToken } = await loadSession();
    const http = { request: mockRequest };
    await getGatewayToken({ http });
    await getGatewayToken({ http });

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
