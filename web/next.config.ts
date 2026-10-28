import path from 'node:path';
import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL?.replace(/\/+$/, '');
const dashboardOrigin = process.env.DASHBOARD_ORIGIN?.replace(/\/+$/, '');

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
   * Single-origin gateway. Rewrites run AFTER middleware, so `/dashboard/*` is only proxied to the
   * SPA once middleware.ts has accepted the session. Routes owned by Next (pages, /api/nextauth,
   * /api/session) always win over these rewrites.
   */
  async rewrites() {
    const afterFiles: { source: string; destination: string }[] = [];
    if (dashboardOrigin) {
      afterFiles.push({ source: '/dashboard/:path*', destination: `${dashboardOrigin}/dashboard/:path*` });
    }
    if (apiUrl) {
      afterFiles.push(
        { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
        { source: '/uploads/:path*', destination: `${apiUrl}/uploads/:path*` },
        { source: '/socket.io/:path*', destination: `${apiUrl}/socket.io/:path*` },
      );
    }
    return { beforeFiles: [], afterFiles, fallback: [] };
  },
};

export default nextConfig;
