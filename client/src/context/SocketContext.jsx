import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

/** A remote (serverless) API has no persistent Socket.IO server — screens fall back to polling. */
const REALTIME_AVAILABLE = !String(import.meta.env.VITE_API_URL ?? '').trim();

export function SocketProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!REALTIME_AVAILABLE || !isAuthenticated || !user) {
      setSocket(null);
      return undefined;
    }

    const token = getToken();
    const instance = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
    });

    // Expose the socket only while connected so polling fallbacks stay active otherwise.
    const handleConnect = () => setSocket(instance);
    const handleDown = () => setSocket(null);
    instance.on('connect', handleConnect);
    instance.on('disconnect', handleDown);
    instance.on('connect_error', handleDown);

    return () => {
      instance.off('connect', handleConnect);
      instance.off('disconnect', handleDown);
      instance.off('connect_error', handleDown);
      instance.disconnect();
      setSocket(null);
    };
  }, [isAuthenticated, user]);

  const value = useMemo(() => ({ socket }), [socket]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  return ctx?.socket ?? null;
}
