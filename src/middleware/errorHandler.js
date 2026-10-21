import { prismaErrorMessage } from '../lib/httpErrors.js';

export function errorHandler(err, _req, res, _next) {
  console.error(err);

  const prismaHint = prismaErrorMessage(err);
  if (prismaHint) {
    return res.status(503).json({ error: prismaHint, code: 'PRISMA_CLIENT_STALE' });
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  const expose = err.expose === true || status < 500;
  const message =
    expose && err.message
      ? err.message
      : status >= 500
        ? 'Internal server error'
        : err.message || 'Request failed';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && err.stack && status >= 500
      ? { detail: err.stack.split('\n').slice(0, 5).join('\n') }
      : {}),
  });
}
