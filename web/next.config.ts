import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Vercel runs `next build` directly. Bake the Vite app into public/dashboard so /dashboard is not a 404
// when no separate DASHBOARD_ORIGIN is configured. Skipped in dev and when an external origin is set.
const embeddedIndex = path.join(process.cwd(), 'public', 'dashboard', 'index.html');
if (process.env.VERCEL && process.env.NODE_ENV === 'production' && !process.env.DASHBOARD_ORIGIN && !fs.existsSync(embeddedIndex)) {
  const script = path.join(process.cwd(), 'scripts', 'build-dashboard.mjs');
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('Failed to build the dashboard SPA for /dashboard');
  }
}

// Dev defaults so `npm run dev` proxies the API and the Vite dashboard without extra env.
// Production stays off until API_URL / DASHBOARD_ORIGIN are set explicitly.
const devDefaults = process.env.NODE_ENV !== 'production';
const apiUrl = (process.env.API_URL ?? (devDefaults ? 'http://localhost:3000' : ''))?.replace(/\/+$/, '');
const dashboardOrigin = (process.env.DASHBOARD_ORIGIN ?? (devDefaults ? 'http://localhost:5173' : ''))?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  // The repo root has its own lockfile (Express API); pin tracing to this app.
  outputFileTracingRoot: path.resolve(process.cwd()),
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // One-time tokens live in these URLs: never leak them through the Referer header.
        source: '/(reset-password|verify-email)',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },

  /**
   * Single-origin gateway. Middleware runs first, so `/dashboard/*` is only proxied once the session
   * is accepted. The dashboard rewrite is a beforeFiles rule (it must beat the App Router 404) and
   * skips `/dashboard/billing`, which is a Next page. `/api/session` and `/api/stripe` stay on Next
   * because afterFiles rewrites lose to real routes.
   */
  async rewrites() {
    // beforeFiles runs before the App Router. `app/dashboard/billing` is a real Next page, so a
    // missing `/dashboard` page would 404 and the afterFiles proxy would never run.
    // Every other `/dashboard/*` path belongs to the Vite SPA.
    const beforeFiles: { source: string; destination: string }[] = [];
    if (dashboardOrigin) {
      beforeFiles.push(
        { source: '/dashboard', destination: `${dashboardOrigin}/dashboard` },
        {
          source: '/dashboard/:path((?!billing$).*)',
          destination: `${dashboardOrigin}/dashboard/:path`,
        },
      );
    } else {
      // Same deployment: public/dashboard/index.html (Vite build, base /dashboard/).
      // Assets live at /dashboard/assets/* and are files, so they are not rewritten.
      beforeFiles.push(
        { source: '/dashboard', destination: '/dashboard/index.html' },
        {
          source: '/dashboard/:path((?!billing$|index\\.html$).*)',
          destination: '/dashboard/index.html',
        },
      );
    }
    const afterFiles: { source: string; destination: string }[] = [];
    if (apiUrl) {
      afterFiles.push(
        { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
        { source: '/uploads/:path*', destination: `${apiUrl}/uploads/:path*` },
        { source: '/socket.io/:path*', destination: `${apiUrl}/socket.io/:path*` },
      );
    }
    return { beforeFiles, afterFiles, fallback: [] };
  },
};

export default nextConfig;
