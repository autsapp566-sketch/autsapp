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
/**
 * @returns {{ message: string, code: string, status: number } | null}
 */
export function prismaErrorInfo(err) {
  const code = err?.code;
  const msg = err?.message ?? '';

  if (
    code === 'P1001' ||
    /can't reach database server|connection refused|ENOTFOUND|ETIMEDOUT/i.test(msg)
  ) {
    return {
      status: 503,
      code: 'DATABASE_UNREACHABLE',
      message:
        'تعذر الاتصال بقاعدة البيانات — تحقق من DATABASE_URL / DIRECT_URL في .env (Supabase) ثم أعد تشغيل API.',
    };
  }

  if (code === 'P2022') {
    return {
      status: 503,
      code: 'DATABASE_SCHEMA_MISMATCH',
      message: 'Database schema mismatch — stop the API, run: npx prisma db push && npx prisma generate, then restart.',
    };
  }

  if (msg.includes('Unknown argument')) {
    return {
      status: 503,
      code: 'PRISMA_CLIENT_STALE',
      message: 'Prisma client out of date — stop the API, run: npx prisma generate, then restart.',
    };
  }

  return null;
}

/** @deprecated use prismaErrorInfo */
export function prismaErrorMessage(err) {
  return prismaErrorInfo(err)?.message ?? null;
}
