import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {
  request: [],
  responseSuccess: [],
  responseError: [],
};

vi.mock('axios', () => {
  const instance = {
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

  it('clears token on 401 for non-login requests', async () => {
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
