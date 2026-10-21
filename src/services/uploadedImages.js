import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

let tableReady = null;

/** Idempotent: creates the table on first use so no manual `db push` is required in production. */
function ensureTable() {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "UploadedImage" (
          "id" TEXT NOT NULL,
          "mimeType" TEXT NOT NULL,
          "data" BYTEA NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UploadedImage_pkey" PRIMARY KEY ("id")
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
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>} image id
 */
export async function saveUploadedImage(buffer, mimeType) {
  await ensureTable();
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "UploadedImage" ("id", "mimeType", "data")
    VALUES (${id}, ${mimeType}, ${buffer})
  `;
  return id;
}

/**
 * @param {string} id
 * @returns {Promise<{ mimeType: string, data: Buffer } | null>}
 */
export async function getUploadedImage(id) {
  await ensureTable();
  const rows = await prisma.$queryRaw`
    SELECT "mimeType", "data" FROM "UploadedImage" WHERE "id" = ${id} LIMIT 1
  `;
  const row = rows?.[0];
  if (!row) {
    return null;
  }
  return { mimeType: row.mimeType, data: Buffer.from(row.data) };
}
