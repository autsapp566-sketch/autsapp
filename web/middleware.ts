import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';

// Edge-safe instance (no providers): it can only *read* the session cookie, which is all middleware needs.
const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

const NO_STORE = 'private, no-store, max-age=0';

/**
 * Route protection.
 *  - /dashboard/**  → requires a valid, unexpired session; otherwise redirected to /login?callbackUrl=…
 *  - /admin/**      → requires a session whose platformRole is SUPER_ADMIN. Everyone else gets a plain
 *                     404 (the panel's existence is not advertised). This is a first, cheap filter: the
 *                     admin layout and every Express /api/admin route re-check the role against the
 *                     DATABASE, so a stale cookie cannot keep admin powers after a demotion.
 *  - /api/admin/**  → never reachable from the browser through this origin (the panel talks to the
 *                     Express API server-to-server), so it is always a 404 here.
 *  - /login, /signup, /forgot-password → signed-in users are sent straight to the dashboard.
 *
 * `req.auth` is non-null only when the encrypted JWT cookie decrypts AND the `jwt` callback in
 * auth.config.ts accepts it (it rejects tokens whose API credential has expired).
 */
export default auth((req) => {
  const { nextUrl } = req;
  const signedIn = Boolean(req.auth?.user?.id);
  const { pathname } = nextUrl;

  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    return notFound(req.nextUrl);
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!signedIn) {
      const url = new URL('/login', nextUrl);
      url.searchParams.set('callbackUrl', `${pathname}${nextUrl.search}`);
      return NextResponse.redirect(url);
    }
    if (req.auth?.user?.platformRole !== 'SUPER_ADMIN') return notFound(nextUrl);
    const res = NextResponse.next();
    res.headers.set('Cache-Control', NO_STORE);
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!signedIn) {
      const url = new URL('/login', nextUrl);
      url.searchParams.set('callbackUrl', `${pathname}${nextUrl.search}`);
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    // Never let a shared cache/CDN or the back button replay an authenticated page.
    res.headers.set('Cache-Control', NO_STORE);
    return res;
  }

  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  return NextResponse.next();
});

/** Rewrites to Next's own 404 page, keeping the 404 status. */
function notFound(nextUrl: URL) {
  return NextResponse.rewrite(new URL('/__not-found', nextUrl), { status: 404 });
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/api/admin/:path*', '/login', '/signup', '/forgot-password'],
};
