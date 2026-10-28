import 'server-only';
import { getToken } from 'next-auth/jwt';

/**
 * Server-side access to the encrypted Auth.js session cookie.
 * The Express API token inside it is the real credential; it never reaches the browser's JS.
 */

export type ApiSession = {
  userId: string;
  platformRole?: string;
  apiToken: string;
};

type HeadersLike = { get(name: string): string | null };

function isSecure(h: HeadersLike): boolean {
  const proto = h.get('x-forwarded-proto') ?? (process.env.AUTH_URL?.startsWith('https') ? 'https' : 'http');
  return proto.split(',')[0].trim() === 'https';
}

export function sessionCookieName(h: HeadersLike) {
  return `${isSecure(h) ? '__Secure-' : ''}authjs.session-token`;
}

/** Name of the httpOnly cookie that carries an active impersonation token (super-admin only). */
export function impersonationCookieName(h: HeadersLike) {
  return isSecure(h) ? '__Host-admin-impersonation' : 'admin-impersonation';
}

export function cookieIsSecure(h: HeadersLike) {
  return isSecure(h);
}

/** The signed-in user's own API session, or null when missing / expired. */
export async function readApiSession(headers: Headers): Promise<ApiSession | null> {
  const name = sessionCookieName(headers);
  const jwt = await getToken({
    req: { headers },
    secret: process.env.AUTH_SECRET,
    secureCookie: isSecure(headers),
    salt: name,
  });
  const expired = typeof jwt?.apiTokenExp === 'number' && Date.now() / 1000 >= jwt.apiTokenExp;
  if (!jwt?.apiToken || !jwt.userId || expired) return null;
  return { userId: jwt.userId, platformRole: jwt.platformRole, apiToken: jwt.apiToken };
}

/** Claims of a JWT **without verifying it** (the API verifies the signature on every call). */
export function decodeJwtClaims(token: string): { sub?: string; imp?: string; exp?: number } | null {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function cookieValue(headers: Headers, name: string): string | null {
  const raw = headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/**
 * The token the dashboard SPA must use: the impersonation token when (and only when) it was issued
 * by THIS signed-in super admin and has not expired; otherwise the user's own token.
 */
export async function resolveDashboardToken(headers: Headers): Promise<{ token: string; impersonating: boolean } | null> {
  const session = await readApiSession(headers);
  if (!session) return null;

  const imp = cookieValue(headers, impersonationCookieName(headers));
  if (imp && session.platformRole === 'SUPER_ADMIN') {
    const claims = decodeJwtClaims(imp);
    const valid =
      claims?.imp === session.userId && typeof claims.exp === 'number' && Date.now() / 1000 < claims.exp;
    if (valid) return { token: imp, impersonating: true };
  }
  return { token: session.apiToken, impersonating: false };
}
