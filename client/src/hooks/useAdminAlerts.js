import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminAlerts } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const POLL_MS = 8000;
const SEEN_KEY = 'adminAlertsSeenAt';

/**
 * System alerts for admins only (e.g. "bot reply not delivered, Green API quota exceeded").
 * They live outside the customer conversation.
 */
export function useAdminAlerts() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [alerts, setAlerts] = useState([]);
  const seenAt = useRef(localStorage.getItem(SEEN_KEY) ?? '');

  useEffect(() => {
    if (!isAdmin) return undefined;
    let stopped = false;

    async function tick() {
      try {
        const data = await fetchAdminAlerts(seenAt.current || undefined);
        if (!stopped) setAlerts(data.alerts ?? []);
      } catch {
        /* ignore transient errors */
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [isAdmin]);

  const dismissAll = useCallback(() => {
    setAlerts((current) => {
      const newest = current[0]?.createdAt;
      if (newest) {
        seenAt.current = newest;
        localStorage.setItem(SEEN_KEY, newest);
      }
      return [];
    });
  }, []);

  return { adminAlerts: alerts, dismissAdminAlerts: dismissAll };
}
