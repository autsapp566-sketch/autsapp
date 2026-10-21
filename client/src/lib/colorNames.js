/** Approximate swatches for common Arabic color names (used when no hex is known). */
const NAME_TO_HEX = {
  أبيض: '#ffffff',
  أسود: '#111111',
  أحمر: '#dc2626',
  أزرق: '#2563eb',
  أخضر: '#16a34a',
  بيج: '#d6c3a1',
  رمادي: '#9ca3af',
  زيتي: '#6b7040',
  وردي: '#f472b6',
  برتقالي: '#f97316',
  أصفر: '#facc15',
  بني: '#7c4a2d',
  بنفسجي: '#8b5cf6',
  كحلي: '#1e2a4a',
  تركوازي: '#14b8a6',
  ذهبي: '#d4af37',
  فضي: '#c0c0c0',
  عنابي: '#7f1d3a',
  سماوي: '#38bdf8',
};

export function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? '').trim());
}

/** Best-effort swatch for a color name; optional `known` map has exact hex values. */
export function swatchForColor(name, known = {}) {
  if (known[name]) return known[name];
  if (NAME_TO_HEX[name]) return NAME_TO_HEX[name];
  const base = Object.keys(NAME_TO_HEX).find((k) => String(name).includes(k));
  return base ? NAME_TO_HEX[base] : null;
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

/** Turn a picked hex (e.g. #1e2a4a) into an Arabic color name with shade (e.g. "كحلي"). */
export function hexToArabicName(hex) {
  if (!isHexColor(hex)) return '';
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.1) return 'أسود';
  if (l > 0.93 && s < 0.3) return 'أبيض';
  if (s < 0.12) {
    if (l > 0.7) return 'رمادي فاتح';
    if (l < 0.3) return 'رمادي غامق';
    return 'رمادي';
  }
  if (h >= 30 && h < 55 && s < 0.5 && l > 0.7) return 'بيج';

  let base;
  if (h < 15 || h >= 345) base = 'أحمر';
  else if (h < 40) base = l < 0.4 ? 'بني' : 'برتقالي';
  else if (h < 65) base = 'أصفر';
  else if (h < 165) base = 'أخضر';
  else if (h < 200) base = 'تركوازي';
  else if (h < 255) base = l < 0.28 ? 'كحلي' : 'أزرق';
  else if (h < 290) base = 'بنفسجي';
  else base = 'وردي';

  if (base === 'كحلي' || base === 'بني') return base;
  if (l > 0.78) return `${base} فاتح`;
  if (l < 0.3) return `${base} غامق`;
  return base;
}
