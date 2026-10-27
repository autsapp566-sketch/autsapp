import { prisma } from '../lib/prisma.js';

/** Rows created before the Evolution migration have provider "green". */
export function isLegacyGreenRow(row) {
  return Boolean(row) && row.provider === 'green';
}

export function isEvolutionRow(row) {
  return Boolean(row) && row.provider !== 'green';
}

export async function findDefaultRow() {
  return prisma.whatsAppInstance.findFirst({
    where: { isDefault: true },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * @param {string | null | undefined} key instance name (Evolution) or Green instance id
 */
export async function findInstanceRow(key) {
  if (!key) return null;
  return prisma.whatsAppInstance.findFirst({
    where: { OR: [{ instanceName: key }, { greenInstanceId: key }] },
  });
}

/**
 * Migration helper: once an Evolution number is connected it replaces a legacy Green API
 * default (or a missing default), so agent replies and notifications leave from the new number.
 * @returns {Promise<boolean>} true if the default changed
 */
export async function promoteDefaultIfLegacy(row) {
  if (!isEvolutionRow(row) || row.isDefault) return false;
  const current = await findDefaultRow();
  if (current && !isLegacyGreenRow(current)) return false;
  await prisma.$transaction([
    prisma.whatsAppInstance.updateMany({ data: { isDefault: false } }),
    prisma.whatsAppInstance.update({ where: { id: row.id }, data: { isDefault: true } }),
  ]);
  return true;
}
