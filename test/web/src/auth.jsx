import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    can(permission) {
      return Boolean(user?.permissions?.includes(permission));
    },
    async login(email, password) {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(data.accessToken);
      setUser(data.user);
      return data.user;
    },
    async logout() {
      try {
        await api('/auth/logout', { method: 'POST' });
      } finally {
        setToken(null);
        setUser(null);
      }
    },
    async switchHospital(hospitalId) {
      const data = await api('/auth/switch-hospital', { method: 'POST', body: { hospitalId } });
      setToken(data.accessToken);
      setUser(data.user);
      return data.user;
    },
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
