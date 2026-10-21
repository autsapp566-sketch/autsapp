import { env } from '../config/env.js';

function escapeRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function toMatcher(entry) {
  const value = entry.trim().replace(/\/+$/, '');
  if (!value) return null;
  if (value.includes('*')) {
    const re = new RegExp(`^${value.split('*').map(escapeRegex).join('.*')}$`, 'i');
    return (origin) => re.test(origin);
  }
  return (origin) => origin.toLowerCase() === value.toLowerCase();
}

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const configured = env.corsOrigin === '*' ? null : env.corsOrigin.split(',').map(toMatcher).filter(Boolean);

/**
 * Auth uses Bearer tokens (no cookies), so allowing the project's own *.vercel.app
 * frontends is safe and avoids "Request failed" when CORS_ORIGIN is missing the client URL.
 */
export function isOriginAllowed(origin) {
  if (!origin) return true;
  if (!configured) return true;
  if (configured.some((match) => match(origin))) return true;
  if (isVercel) {
    try {
      return new URL(origin).hostname.endsWith('.vercel.app');
    } catch {
      return false;
    }
  }
  return false;
}

export const corsOptions = {
  origin(origin, cb) {
    cb(null, isOriginAllowed(origin));
  },
  credentials: true,
};
