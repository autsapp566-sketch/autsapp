/**
 * @param {string} message
 * @param {number} [status=400]
 */
export function createHttpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

/**
 * @param {unknown} err
 */
export function prismaErrorMessage(err) {
  const code = err?.code;
  const msg = err?.message ?? '';

  if (code === 'P2022') {
    return 'Database schema mismatch — stop the API, run: npx prisma generate, then restart.';
  }
  if (msg.includes('Unknown argument') || msg.includes('Invalid `prisma.')) {
    return 'Prisma client out of date — stop the API, run: npx prisma generate, then restart.';
  }
  return null;
}
