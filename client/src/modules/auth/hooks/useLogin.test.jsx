import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/shared/lib/queryClient.js';
import { AuthProvider } from './useAuth.jsx';
import { useLogin } from './useLogin.js';
import { setToken } from '@/shared/api/token.js';

vi.mock('../api/authApi.js', () => ({
  login: vi.fn(async () => ({
    accessToken: 'token-1',
    user: { id: 'u1', name: 'Demo Staff', email: 'staff@example.com', role: 'STAFF' },
  })),
  logout: vi.fn(async () => ({})),
  getMe: vi.fn(async () => ({ id: 'u1', name: 'Demo Staff', email: 'staff@example.com', role: 'STAFF' })),
}));

function wrapper({ children }) {
  const client = createQueryClient();
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

describe('useLogin', () => {
  beforeEach(() => {
    setToken(null);
  });

  it('logs in and stores the access token', async () => {
    const { result } = renderHook(() => useLogin(), { wrapper });
    await result.current.mutateAsync({
      email: 'staff@example.com',
      password: '12345678',
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const { getToken } = await import('@/shared/api/token.js');
    expect(getToken()).toBe('token-1');
  });
});
