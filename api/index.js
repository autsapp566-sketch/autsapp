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

/** After rewrite to `/api`, req.url may be `/`, `/health`, `/api`, or `/api/health`. */
function requestPath(req) {
  let p = (req.url ?? '/').split('?')[0];
  if (p.startsWith('/api/')) {
    p = `/${p.slice(5)}`.replace(/\/+/g, '/') || '/';
  } else if (p === '/api') {
    p = '/';
  }
  return p;
}

function isShellPath(p) {
  return p === '/' || p === '/health';
}

let fullAppPromise = null;

function getFullApp() {
  if (!fullAppPromise) {
    fullAppPromise = import('../src/app.js').then(({ createApp }) => createApp());
  }
  return fullAppPromise;
}

export default function handler(req, res) {
  const path = requestPath(req);

  if (isShellPath(path)) {
    if (path === '/health') {
      req.url = '/health';
    } else {
      req.url = '/';
    }
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
