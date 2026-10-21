import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLeads } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import {
  loadSoundPrefs,
  playRingtone,
  ringtoneDurationMs,
  saveSoundPrefs,
  unlockAudio,
} from '../lib/alertSounds.js';

const ALL_STATUSES = ['NEW', 'QUALIFYING', 'QUALIFIED', 'HANDED_OFF', 'REJECTED'];
const POLL_MS = 6000;
const STORAGE_KEY = 'leadSoundAlerts';

function leadLabel(lead) {
  return lead?.name || lead?.phone || 'عميل';
}

/**
 * Plays a loud siren when a chat switches to human control (AI paused) and a
 * different chime when a lead becomes "handed off" (تحت التسليم).
 * Works with polling (Vercel has no Socket.IO) and with socket events.
 */
export function useLeadSoundAlerts() {
  const { user } = useAuth();
  const socket = useSocket();
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'off');
  const [banner, setBanner] = useState(null);
  const [prefs, setPrefs] = useState(loadSoundPrefs);
  const prefsRef = useRef(prefs);
  const enabledRef = useRef(soundEnabled);
  const seen = useRef(null);
  const userIdRef = useRef(user?.id);
  const busyUntil = useRef(0);

  useEffect(() => {
    enabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user]);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const play = useCallback((human, handoff) => {
    if (!human && !handoff) return;
    const now = Date.now();
    const prefs = prefsRef.current;
    const delay = Math.max(0, busyUntil.current - now);
    let total = delay;
    if (human) {
      const id = prefs.human;
      setTimeout(() => playRingtone(id), total);
      total += ringtoneDurationMs(id);
    }
    if (handoff) {
      const id = prefs.handoff;
      setTimeout(() => playRingtone(id), total);
      total += ringtoneDurationMs(id);
    }
    busyUntil.current = now + total;
  }, []);

  const setRingtone = useCallback((event, id) => {
    const next = { ...prefsRef.current, [event]: Number(id) };
    prefsRef.current = next;
    setPrefs(next);
    saveSoundPrefs(next);
    unlockAudio();
    playRingtone(next[event]);
  }, []);

  const previewRingtone = useCallback((id) => {
    unlockAudio();
    playRingtone(id);
  }, []);

  const process = useCallback(
    (leads) => {
      const baseline = seen.current === null;
      if (baseline) seen.current = new Map();

      let human = null;
      let handoff = null;

      for (const lead of leads) {
        const prev = seen.current.get(lead.id) ?? { status: 'NEW', aiPaused: false };
        seen.current.set(lead.id, { status: lead.status, aiPaused: Boolean(lead.aiPaused) });
        if (baseline) continue;

        const becameHandoff = prev.status !== 'HANDED_OFF' && lead.status === 'HANDED_OFF';
        const becameHuman = !prev.aiPaused && Boolean(lead.aiPaused);
        // Ignore the agent's own manual takeover click.
        const selfAction = lead.assignedToId && lead.assignedToId === userIdRef.current && lead.status !== 'HANDED_OFF';

        if (becameHandoff && !handoff) handoff = lead;
        if (becameHuman && !selfAction && !human) human = lead;
      }

      if (!human && !handoff) return;

      if (enabledRef.current) play(Boolean(human), Boolean(handoff));
      const lead = human ?? handoff;
      setBanner({
        kind: human ? 'human' : 'handoff',
        text: human
          ? `🚨 تحكم بشري مطلوب: ${leadLabel(lead)}`
          : `🔔 عميل جديد تحت التسليم: ${leadLabel(lead)}`,
        leadId: lead.id,
      });
    },
    [play]
  );

  useEffect(() => {
    if (!user) return undefined;
    let stopped = false;

    async function tick() {
      try {
        const data = await fetchLeads(ALL_STATUSES);
        if (!stopped) process(data.leads ?? []);
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
  }, [user, process]);

  // Instant path when Socket.IO is available.
  useEffect(() => {
    if (!socket || !user) return undefined;
    const onLead = (payload) => {
      if (payload?.lead && seen.current) process([payload.lead]);
    };
    socket.on('lead:updated', onLead);
    socket.on('lead:qualified', onLead);
    return () => {
      socket.off('lead:updated', onLead);
      socket.off('lead:qualified', onLead);
    };
  }, [socket, user, process]);

  const toggleSound = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setSoundEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    if (next) {
      // Preview both sounds (this click also unlocks audio).
      unlockAudio();
      busyUntil.current = 0;
      play(true, true);
    }
  }, [play]);

  return {
    soundEnabled,
    toggleSound,
    prefs,
    setRingtone,
    previewRingtone,
    banner,
    dismissBanner: () => setBanner(null),
  };
}
