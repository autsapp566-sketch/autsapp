import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

export function useLeadRealtime({ leadId, onMessage, onLeadUpdated }) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !leadId) {
      return undefined;
    }

    socket.emit('lead:subscribe', leadId);

    const handleMessage = (payload) => {
      if (payload?.leadId === leadId) {
        onMessage?.(payload.message);
      }
    };

    const handleLead = (payload) => {
      if (payload?.lead?.id === leadId) {
        onLeadUpdated?.(payload.lead);
      }
    };

    socket.on('message:new', handleMessage);
    socket.on('lead:updated', handleLead);

    return () => {
      socket.emit('lead:unsubscribe', leadId);
      socket.off('message:new', handleMessage);
      socket.off('lead:updated', handleLead);
    };
  }, [socket, leadId, onMessage, onLeadUpdated]);
}

export function useLeadsListRealtime({ onLeadUpdated, onQualified, onMessage }) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    socket.on('lead:updated', onLeadUpdated);
    socket.on('lead:qualified', onQualified);
    socket.on('message:new', onMessage);

    return () => {
      socket.off('lead:updated', onLeadUpdated);
      socket.off('lead:qualified', onQualified);
      socket.off('message:new', onMessage);
    };
  }, [socket, onLeadUpdated, onQualified, onMessage]);
}
