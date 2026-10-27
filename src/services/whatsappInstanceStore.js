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
 * Database id of the number a webhook belongs to (Evolution instanceName or Green idInstance).
 * @returns {Promise<string | null>} null when the key matches no registered number
 */
export async function resolveInstanceId(key) {
  const row = await findInstanceRow(key);
  return row?.id ?? null;
}

/**
 * Key the messaging layer understands for a stored conversation's number
 * (Evolution instanceName, or the Green instance id for legacy rows). Undefined = default number.
 * @param {{ instanceId?: string | null }} lead
 */
export async function sendKeyForLead(lead) {
  if (!lead?.instanceId) return undefined;
  const row = await prisma.whatsAppInstance.findUnique({ where: { id: lead.instanceId } });
  if (!row) return undefined;
  return isLegacyGreenRow(row) ? row.greenInstanceId ?? undefined : row.instanceName;
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
