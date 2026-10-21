import { useRef, useState } from 'react';

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`;
}

function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** Drag area: calls onMove(x, y) with 0..1 values relative to the element. */
function useDrag(onMove) {
  const ref = useRef(null);
  function handle(e) {
    const rect = ref.current.getBoundingClientRect();
    onMove(clamp((e.clientX - rect.left) / rect.width, 0, 1), clamp((e.clientY - rect.top) / rect.height, 0, 1));
  }
  return {
    ref,
    onPointerDown(e) {
      e.currentTarget.setPointerCapture(e.pointerId);
      handle(e);
    },
    onPointerMove(e) {
      if (e.buttons) handle(e);
    },
  };
}

/** CSS-only color square (saturation/brightness) + hue slider. */
export default function ColorSquarePicker({ value, onChange }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#7c3aed'));

  function update(next) {
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  }

  const square = useDrag((x, y) => update({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag((x) => update({ ...hsv, h: x * 360 }));
  const hueColor = hsvToHex(hsv.h, 1, 1);

  return (
    <div className="space-y-2" dir="ltr">
      <div
        {...square}
        ref={square.ref}
        className="relative h-40 w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-slate-600"
        style={{
          backgroundColor: hueColor,
          backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }}
        />
      </div>
      <div
        {...hue}
        ref={hue.ref}
        className="relative h-4 w-full cursor-pointer touch-none select-none rounded-full border border-slate-600"
        style={{
          backgroundImage:
            'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
        />
      </div>
    </div>
  );
}
