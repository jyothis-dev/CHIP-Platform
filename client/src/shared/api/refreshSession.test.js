import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: { post },
}));

describe('refreshAccessToken', () => {
  beforeEach(() => {
    post.mockReset();
    vi.resetModules();
  });

  it('stores the new access token from the refresh cookie call', async () => {
    post.mockResolvedValue({
      data: { success: true, data: { accessToken: 'next-token', expiresIn: '15m' } },
    });
    const tokenApi = await import('./token.js');
    tokenApi.clearToken();
    const { refreshAccessToken } = await import('./refreshSession.js');

    await expect(refreshAccessToken()).resolves.toBe('next-token');

    expect(post).toHaveBeenCalledWith('/api/auth/refresh', {}, { withCredentials: true });
    expect(tokenApi.getToken()).toBe('next-token');
  });

  it('shares one refresh call across overlapping requests', async () => {
    let resolvePost;
    post.mockReturnValue(new Promise((resolve) => {
      resolvePost = resolve;
    }));
    const { refreshAccessToken } = await import('./refreshSession.js');
    const first = refreshAccessToken();
    const second = refreshAccessToken();
    resolvePost({
      data: { success: true, data: { accessToken: 'shared-token' } },
    });
    await expect(Promise.all([first, second])).resolves.toEqual(['shared-token', 'shared-token']);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
