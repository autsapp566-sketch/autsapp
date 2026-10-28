import { prismaErrorInfo } from '../lib/httpErrors.js';

export function errorHandler(err, _req, res, _next) {
  // Entitlement failures are expected business outcomes (not server errors): machine-readable code
  // so the dashboard can show an "upgrade / renew" prompt.
  if (err?.billing === true) {
    return res.status(err.status ?? 402).json({ error: err.message, code: err.code, ...err.details });
  }

  console.error(err);

  const prismaHint = prismaErrorInfo(err);
  if (prismaHint) {
    return res.status(prismaHint.status).json({
      error: prismaHint.message,
      code: prismaHint.code,
    });
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
