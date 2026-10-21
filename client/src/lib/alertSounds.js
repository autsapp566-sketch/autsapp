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

function tone(c, { type, freq, start, duration, volume }) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.setValueAtTime(volume, start + duration - 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const HUMAN_ALARM_MS = 2600;
export const HANDOFF_CHIME_MS = 1300;

/** Loud urgent siren (two alternating high tones, square wave) — "human control". */
export function playHumanControlAlarm() {
  const c = getCtx();
  if (!c) return;
  unlockAudio();
  const t0 = c.currentTime + 0.05;
  for (let i = 0; i < 8; i += 1) {
    tone(c, {
      type: 'square',
      freq: i % 2 === 0 ? 988 : 740,
      start: t0 + i * 0.3,
      duration: 0.26,
      volume: 0.6,
    });
  }
}

/** Softer ascending chime (sine/triangle arpeggio) — "handed off to confirmation agent". */
export function playHandoffChime() {
  const c = getCtx();
  if (!c) return;
  unlockAudio();
  const t0 = c.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone(c, { type: 'triangle', freq, start: t0 + i * 0.25, duration: i === 3 ? 0.5 : 0.22, volume: 0.35 });
  });
}
