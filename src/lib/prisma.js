import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function resolvePrismaDatabaseUrl() {
  const pooled = process.env.DATABASE_URL?.trim();
  const direct = process.env.DIRECT_URL?.trim();
  if (process.env.VERCEL) {
    return pooled;
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
