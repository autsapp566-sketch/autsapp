import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export function useLeadNotifications() {
  const { user } = useAuth();
  const socket = useSocket();
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!socket || !user) {
      return undefined;
    }

    if (user.role !== 'CONFIRMATION_AGENT' && user.role !== 'ADMIN') {
      return undefined;
    }

    const onQualified = (payload) => setAlert(payload);
    socket.on('lead:qualified', onQualified);

    return () => {
      socket.off('lead:qualified', onQualified);
    };
  }, [socket, user]);

  return { alert, dismissAlert: () => setAlert(null) };
}
