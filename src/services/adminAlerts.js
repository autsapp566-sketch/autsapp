import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

let tableReady = null;

/** Idempotent: created on first use so no manual `db push` is needed in production. */
function ensureTable() {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "AdminAlert" (
          "id" TEXT NOT NULL,
          "organizationId" TEXT,
          "kind" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "leadId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
        )`
      )
      // Table created before multi-tenancy: add the tenant column (idempotent).
      .then(() => prisma.$executeRawUnsafe(`ALTER TABLE "AdminAlert" ADD COLUMN IF NOT EXISTS "organizationId" TEXT`))
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

const DEDUPE_MINUTES = 10;

/**
 * Alert shown only to the admins of ONE organization in the dashboard (never sent to customers).
 * The same kind for the same lead is not repeated within a few minutes.
 * Never throws.
 * @param {{ organizationId: string, kind: string, message: string, leadId?: string | null }} alert
 */
export async function createAdminAlert({ organizationId, kind, message, leadId = null }) {
  if (!organizationId) {
    console.error('[admin-alert] dropped: organizationId is required');
    return null;
  }
  try {
    await ensureTable();
    const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000);
    const existing = await prisma.$queryRaw`
      SELECT "id" FROM "AdminAlert"
      WHERE "organizationId" = ${organizationId} AND "kind" = ${kind} AND "createdAt" > ${since}
        AND COALESCE("leadId", '') = ${leadId ?? ''}
      LIMIT 1
    `;
    if (existing?.length) {
      return null;
    }
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "AdminAlert" ("id", "organizationId", "kind", "message", "leadId")
      VALUES (${id}, ${organizationId}, ${kind}, ${message}, ${leadId})
    `;
    return id;
  } catch (err) {
    console.error('[admin-alert] could not save:', err.message);
    return null;
  }
}

/**
 * @param {string} organizationId
 * @param {Date | null} after only alerts newer than this
 * @returns {Promise<{ id: string, kind: string, message: string, leadId: string | null, createdAt: Date }[]>}
 */
export async function listAdminAlerts(organizationId, after = null) {
  const since = after ?? new Date(Date.now() - 60 * 60_000);
  const query = () => prisma.$queryRaw`
    SELECT "id", "kind", "message", "leadId", "createdAt" FROM "AdminAlert"
    WHERE "organizationId" = ${organizationId} AND "createdAt" > ${since}
    ORDER BY "createdAt" DESC
    LIMIT 20
  `;
  await ensureTable();
  try {
    return await query();
  } catch (err) {
    // Table dropped after this warm instance cached "ready" (e.g. DB reset): recreate once and retry.
    if (!/42P01|does not exist/i.test(String(err?.message ?? err?.code))) throw err;
    tableReady = null;
    await ensureTable();
    return query();
  }
}
