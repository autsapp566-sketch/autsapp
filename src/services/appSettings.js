import { prisma } from '../lib/prisma.js';

let tableReady = null;

/** Idempotent: tiny key/value table created on first use (no manual `db push` needed in production). */
function ensureTable() {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "AppSetting" (
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
        )`
      )
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

/**
 * @param {string} key
 * @returns {Promise<unknown | null>} parsed JSON value
 */
export async function getAppSetting(key) {
  await ensureTable();
  const rows = await prisma.$queryRaw`SELECT "value" FROM "AppSetting" WHERE "key" = ${key} LIMIT 1`;
  const raw = rows?.[0]?.value;
  if (raw == null) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {unknown} value any JSON-serialisable value
 */
export async function setAppSetting(key, value) {
  await ensureTable();
  const json = JSON.stringify(value);
  await prisma.$executeRaw`
    INSERT INTO "AppSetting" ("key", "value", "updatedAt")
    VALUES (${key}, ${json}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP
  `;
}
