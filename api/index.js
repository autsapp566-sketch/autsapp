import express from 'express';

const shell = express();
shell.get('/', (_req, res) => {
  res.json({
    service: 'whatsapp-ai-qualification-handoff',
    health: '/health',
    api: '/api',
  });
});
shell.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

let fullAppPromise = null;

function getFullApp() {
  if (!fullAppPromise) {
    fullAppPromise = import('../src/app.js').then(({ createApp }) => createApp());
  }
  return fullAppPromise;
}

/** @type {import('@vercel/node').VercelRequestHandler} */
export default function handler(req, res) {
  const pathname = (req.url ?? '/').split('?')[0];

  if (pathname === '/' || pathname === '/health') {
    return shell(req, res);
  }

  getFullApp()
    .then((app) => app(req, res))
    .catch((err) => {
      console.error('[api] init failed', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err?.message ?? 'APP_INIT_FAILED',
          hint: 'Check DATABASE_URL, JWT_SECRET, and Prisma generate on Vercel.',
        });
      }
    });
}
