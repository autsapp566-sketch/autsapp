import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearToken,
  fetchMe,
  gatewayLogout,
  getToken,
  login as loginRequest,
  redirectToGatewayLogin,
  setToken,
  syncGatewaySession,
} from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Set while a platform super admin is viewing this account (token minted by the admin panel).
  const [impersonation, setImpersonation] = useState(null);
  const [loading, setLoading] = useState(true);
  // True when the SPA is served behind the Next.js gateway (session owned by Next.js).
  const gatewayRef = useRef(false);

  /** @returns {boolean} true when the page is being handed to the gateway login (caller must not navigate). */
  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    if (gatewayRef.current) {
      gatewayLogout().finally(() => window.location.assign('/login'));
      return true;
    }
    return false;
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
      const gateway = await syncGatewaySession();
      gatewayRef.current = gateway.gateway;

      if (gateway.gateway && !gateway.authenticated) {
        redirectToGatewayLogin();
        return;
      }

      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { user: me, impersonation: imp } = await fetchMe();
        if (!cancelled) {
          setUser(me);
          setImpersonation(imp ?? null);
        }
      } catch {
        clearToken();
        if (gateway.gateway) {
          // The API rejected the token (revoked, user disabled, ...): end the web session too.
          await gatewayLogout();
          redirectToGatewayLogin();
          return;
        }
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
      impersonation,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, impersonation, loading, login, logout]
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
