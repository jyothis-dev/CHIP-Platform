import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/authApi.js';
import {
  clearToken, getToken, setToken, subscribeToken,
} from '@/shared/api/token.js';
import { resetUnauthorizedFlag } from '@/shared/api/sessionEvents.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  // Subscribe so clearing the token (logout, 401) re-renders and drops `user` at once.
  const hasToken = Boolean(useSyncExternalStore(subscribeToken, getToken));

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    enabled: hasToken,
    retry: false,
  });

  useEffect(() => {
    if (meQuery.isError) {
      clearToken();
    }
  }, [meQuery.isError]);

  const value = useMemo(() => {
    const ready = !hasToken || meQuery.isFetched || meQuery.isError;
    const user = hasToken && meQuery.isSuccess ? meQuery.data : null;

    return {
      user,
      ready,
      async login(email, password) {
        const data = await authApi.login({ email, password });
        setToken(data.accessToken);
        resetUnauthorizedFlag();
        queryClient.setQueryData(['auth', 'me'], data.user);
        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        return data.user;
      },
      async logout() {
        try {
          await authApi.logout();
        } catch {
          // Still clear local session.
        } finally {
          clearToken();
          queryClient.clear();
          resetUnauthorizedFlag();
        }
      },
    };
  }, [hasToken, meQuery.data, meQuery.isError, meQuery.isFetched, meQuery.isSuccess, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
