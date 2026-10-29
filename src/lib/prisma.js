import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

/**
 * Supabase's session pooler (port 5432) allows about 15 clients. A Vercel function
 * opens a whole Prisma pool, and the admin overview runs many queries at once, so
 * that cap is hit and Postgres returns EMAXCONNSESSION. Transaction mode (6543)
 * with a single connection per function is the serverless setup. Migrations stay
 * on DIRECT_URL (5432) and are not affected.
 */
function serverlessPoolUrl(url) {
  if (!url) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.hostname.endsWith('.pooler.supabase.com')) return url;
  if (parsed.port === '5432' || parsed.port === '') parsed.port = '6543';
  parsed.searchParams.set('pgbouncer', 'true');
  if (!parsed.searchParams.has('connection_limit')) parsed.searchParams.set('connection_limit', '1');
  return parsed.toString();
}

function resolvePrismaDatabaseUrl() {
  const pooled = process.env.DATABASE_URL?.trim();
  const direct = process.env.DIRECT_URL?.trim();
  if (process.env.VERCEL) {
    return serverlessPoolUrl(pooled);
  }
  if (direct && process.env.NODE_ENV !== 'production') {
    return direct;
  }
  return pooled;
}

const databaseUrl = resolvePrismaDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
