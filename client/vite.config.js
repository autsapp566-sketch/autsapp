import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_ASSET_BASE: absolute URL of this SPA's own origin (e.g. https://dashboard.example.com/).
// Required when the SPA is reverse-proxied under the Next.js site (web/), otherwise the browser
// would request /assets/* from the Next.js origin. Leave unset for the standalone deployment.
const assetBase = process.env.VITE_ASSET_BASE?.trim();

export default defineConfig({
  base: assetBase ? assetBase.replace(/\/*$/, '/') : '/',
  plugins: [react()],
  server: {
    port: 5173,
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
});
