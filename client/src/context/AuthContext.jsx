import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, fetchMe, getToken, login as loginRequest, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: loggedInUser } = await loginRequest(email, password);
    setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { user: me } = await fetchMe();
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        clearToken();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
