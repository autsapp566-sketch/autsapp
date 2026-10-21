import { useEffect, useRef, useState } from 'react';
import { RINGTONES } from '../../lib/alertSounds.js';

const EVENTS = [
  { key: 'human', title: '🚨 تحكم بشري', hint: 'عندما يتوقف البوت وتنتقل المحادثة للتحكم البشري' },
  { key: 'handoff', title: '🔔 تحت التسليم', hint: 'عندما يصبح العميل جاهزاً للتسليم لموظفة التأكيد' },
];

function IntensityBar({ level }) {
  return (
    <span className="flex items-end gap-px" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={['w-1 rounded-sm', i < level ? 'bg-amber-400' : 'bg-slate-700'].join(' ')}
          style={{ height: `${6 + i * 1.2}px` }}
        />
      ))}
    </span>
  );
}

export default function SoundSettingsPanel({ soundEnabled, toggleSound, prefs, setRingtone, previewRingtone }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('human');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const current = EVENTS.find((e) => e.key === tab) ?? EVENTS[0];

  return (
    <div className="relative flex items-center gap-1" ref={rootRef}>
      <button
        type="button"
        onClick={toggleSound}
        title={soundEnabled ? 'الإشعارات الصوتية مفعّلة — اضغط لإيقافها' : 'اضغط لتفعيل الإشعارات الصوتية'}
        className={[
          'rounded-lg border px-3 py-2 text-sm font-medium transition',
          soundEnabled
            ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
            : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700',
        ].join(' ')}
      >
        {soundEnabled ? '🔔 الصوت مفعّل' : '🔕 الصوت متوقف'}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="اختيار الرنات"
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
      >
        🎵 الرنات
      </button>

      {open ? (
        <div className="absolute end-0 top-full z-30 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-3 flex gap-2">
            {EVENTS.map((ev) => (
              <button
                key={ev.key}
                type="button"
                onClick={() => setTab(ev.key)}
                className={[
                  'flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition',
                  tab === ev.key ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                {ev.title}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] text-slate-400">{current.hint}</p>
          <p className="mb-2 flex justify-between text-[10px] text-slate-500">
            <span>خفيفة</span>
            <span>حادة</span>
          </p>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {RINGTONES.map((r) => {
              const selected = prefs[current.key] === r.id;
              return (
                <li key={r.id}>
                  <div
                    className={[
                      'flex items-center gap-2 rounded-lg border px-2 py-1.5 transition',
                      selected ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-transparent hover:bg-slate-800',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => setRingtone(current.key, r.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    >
                      <span
                        className={[
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]',
                          selected ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-slate-600',
                        ].join(' ')}
                      >
                        {selected ? '✓' : ''}
                      </span>
                      <span className="w-5 shrink-0 text-xs text-slate-500">{r.id}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{r.name}</span>
                      <IntensityBar level={r.id} />
                    </button>
                    <button
                      type="button"
                      onClick={() => previewRingtone(r.id)}
                      title="استمع"
                      className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      ▶
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
