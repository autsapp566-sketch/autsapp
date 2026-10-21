import { prismaErrorInfo } from '../lib/httpErrors.js';

export function errorHandler(err, _req, res, _next) {
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
