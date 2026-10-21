let ctx = null;

function getCtx() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Browsers block audio until a user gesture; call this from a click/keydown. */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') {
    c.resume().catch(() => {});
  }
}

/**
 * Ringtones ordered from light (1) to intense (10).
 * notes: [frequencyHz, durationSec, gapSec, endFrequencyHz?]  (endFrequency = sweep)
 */
export const RINGTONES = [
  { id: 1, name: 'نسمة', type: 'sine', volume: 0.18, notes: [[660, 0.5, 0]] },
  { id: 2, name: 'قطرة ماء', type: 'sine', volume: 0.25, notes: [[784, 0.18, 0.08], [988, 0.3, 0]] },
  {
    id: 3,
    name: 'جرس ناعم',
    type: 'triangle',
    volume: 0.3,
    notes: [[523.25, 0.2, 0.05], [659.25, 0.2, 0.05], [783.99, 0.2, 0.05], [1046.5, 0.45, 0]],
  },
  {
    id: 4,
    name: 'نغمة مزدوجة',
    type: 'triangle',
    volume: 0.4,
    notes: [[784, 0.18, 0.1], [1046, 0.28, 0.25], [784, 0.18, 0.1], [1046, 0.28, 0]],
  },
  {
    id: 5,
    name: 'بيب متوسط',
    type: 'sine',
    volume: 0.5,
    notes: [[880, 0.2, 0.15], [880, 0.2, 0.15], [880, 0.2, 0]],
  },
  {
    id: 6,
    name: 'منبّه',
    type: 'square',
    volume: 0.35,
    notes: [[1000, 0.12, 0.08], [1000, 0.12, 0.08], [1000, 0.12, 0.08], [1000, 0.12, 0.3], [1000, 0.12, 0.08], [1000, 0.12, 0]],
  },
  {
    id: 7,
    name: 'تنبيه سريع',
    type: 'sawtooth',
    volume: 0.4,
    notes: Array.from({ length: 6 }, (_, i) => [i % 2 ? 1175 : 880, 0.18, 0.04]),
  },
  {
    id: 8,
    name: 'صفارة',
    type: 'square',
    volume: 0.55,
    notes: Array.from({ length: 8 }, (_, i) => [i % 2 ? 740 : 988, 0.26, 0.04]),
  },
  {
    id: 9,
    name: 'إنذار حاد',
    type: 'sawtooth',
    volume: 0.7,
    notes: Array.from({ length: 12 }, (_, i) => [i % 2 ? 900 : 1300, 0.14, 0.03]),
  },
  {
    id: 10,
    name: 'طوارئ قصوى',
    type: 'square',
    volume: 0.85,
    notes: Array.from({ length: 5 }, () => [600, 0.5, 0.05, 1500]),
  },
];

export function getRingtone(id) {
  return RINGTONES.find((r) => r.id === Number(id)) ?? RINGTONES[0];
}

export function ringtoneDurationMs(id) {
  const r = getRingtone(id);
  return Math.round(r.notes.reduce((sum, [, dur, gap]) => sum + dur + gap, 0) * 1000) + 100;
}

function tone(c, { type, freq, endFreq, start, duration, volume }) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.setValueAtTime(volume, start + Math.max(0.02, duration - 0.04));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Play a ringtone by id (1..10). Returns its duration in ms. */
export function playRingtone(id) {
  const c = getCtx();
  if (!c) return 0;
  unlockAudio();
  const r = getRingtone(id);
  let t = c.currentTime + 0.05;
  for (const [freq, duration, gap, endFreq] of r.notes) {
    tone(c, { type: r.type, freq, endFreq, start: t, duration, volume: r.volume });
    t += duration + gap;
  }
  return ringtoneDurationMs(r.id);
}

const PREFS_KEY = 'leadSoundPrefs';
export const DEFAULT_PREFS = { human: 8, handoff: 3 };

export function loadSoundPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      human: getRingtone(raw.human ?? DEFAULT_PREFS.human).id,
      handoff: getRingtone(raw.handoff ?? DEFAULT_PREFS.handoff).id,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveSoundPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
