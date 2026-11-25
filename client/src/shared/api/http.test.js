import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {
  request: [],
  responseSuccess: [],
  responseError: [],
};

const refreshAccessToken = vi.hoisted(() => vi.fn());
const httpRequest = vi.hoisted(() => vi.fn());

vi.mock('./refreshSession.js', () => ({
  refreshAccessToken,
}));

vi.mock('axios', () => {
  const instance = {
    request: (...args) => httpRequest(...args),
    interceptors: {
      request: {
        use: (fn) => {
          handlers.request.push(fn);
        },
      },
      response: {
        use: (onSuccess, onError) => {
          handlers.responseSuccess.push(onSuccess);
          handlers.responseError.push(onError);
        },
      },
    },
  };
  return {
    default: {
      create: () => instance,
    },
  };
});

describe('http client', () => {
  let tokenApi;

  beforeEach(async () => {
    handlers.request.length = 0;
    handlers.responseSuccess.length = 0;
    handlers.responseError.length = 0;
    refreshAccessToken.mockReset();
    refreshAccessToken.mockRejectedValue(new Error('no refresh session'));
    httpRequest.mockReset();
    vi.resetModules();
    tokenApi = await import('./token.js');
    tokenApi.clearToken();
    await import('./http.js');
  });

  it('unwraps successful envelope data', async () => {
    const onSuccess = handlers.responseSuccess[0];
    const result = onSuccess({
      data: { success: true, data: { id: '1' } },
      status: 200,
    });
    expect(result).toEqual({ id: '1' });
  });

  it('maps error envelope to ApiError', async () => {
    const onError = handlers.responseError[0];
    await expect(
      onError({
        config: { url: '/patients' },
        response: {
          status: 400,
          data: { success: false, code: 'VALIDATION_ERROR', message: 'Invalid' },
        },
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid',
    });
  });

  it('retries a 401 once after the refresh cookie issues a new access token', async () => {
    tokenApi.setToken('stale-token');
    refreshAccessToken.mockImplementation(async () => {
      tokenApi.setToken('fresh-token');
      return 'fresh-token';
    });
    httpRequest.mockResolvedValue({
      data: { success: true, data: { id: 'patient-1' } },
      status: 200,
    });
    const onError = handlers.responseError[0];
    const result = await onError({
      config: { url: '/patients', headers: { Authorization: 'Bearer stale-token' } },
      response: {
        status: 401,
        data: { success: false, code: 'UNAUTHENTICATED', message: 'Authentication required' },
      },
    });
    expect(result).toEqual({
      data: { success: true, data: { id: 'patient-1' } },
      status: 200,
    });
    expect(httpRequest).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
    }));
    expect(tokenApi.getToken()).toBe('fresh-token');
  });

  it('clears token on 401 when refresh fails', async () => {
    tokenApi.setToken('stale-token');
    const onError = handlers.responseError[0];
    await expect(
      onError({
        config: { url: '/patients' },
        response: {
          status: 401,
          data: { success: false, code: 'UNAUTHENTICATED', message: 'Authentication required' },
        },
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(tokenApi.getToken()).toBeNull();
  });

  it('attaches bearer token on request', async () => {
    tokenApi.setToken('abc');
    const onRequest = handlers.request[0];
    const config = await onRequest({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc');
  });
});
