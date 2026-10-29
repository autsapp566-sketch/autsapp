import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_ASSET_BASE: absolute URL of this SPA's own origin (e.g. https://dashboard.example.com/).
// Required when the SPA is reverse-proxied under the Next.js site (web/), otherwise the browser
// would request /assets/* from the Next.js origin. Leave unset for the standalone deployment.
const assetBase = process.env.VITE_ASSET_BASE?.trim();
// Built into the Next.js site (public/dashboard) so /dashboard works on one Vercel project.
const embedded = process.env.VITE_EMBEDDED === '1';

// Vite ignores an absolute `base` during `vite dev` (it keeps only the pathname).
// When Next serves this HTML on :3001, root-relative /src and /@vite would 404 there.
function devGatewayAssets() {
  const origin = 'http://localhost:5173';
  return {
    name: 'dev-gateway-assets',
    transformIndexHtml(html) {
      const abs = (path) => `${origin}${path}`;
      return html
        .replace(/(\s(?:src|href)=")(\/(?!\/)[^"]*)(")/g, (_, a, path, c) => `${a}${abs(path)}${c}`)
        .replace(/from "(\/(?!\/)[^"]*)"/g, (_, path) => `from "${abs(path)}"`);
    },
  };
}

export default defineConfig(({ command }) => ({
  base: assetBase ? assetBase.replace(/\/*$/, '/') : embedded ? '/dashboard/' : '/',
  plugins: [react(), ...(command === 'serve' ? [devGatewayAssets()] : [])],
  server: {
    port: 5173,
    // Module URLs (CSS, images) are prefixed with this when the page is on another origin.
    origin: 'http://localhost:5173',
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
}));
