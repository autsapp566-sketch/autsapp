import { prisma } from '../lib/prisma.js';

/** Rows created before the Evolution migration have provider "green". */
export function isLegacyGreenRow(row) {
  return Boolean(row) && row.provider === 'green';
}

export function isEvolutionRow(row) {
  return Boolean(row) && row.provider !== 'green';
}

/** Default sending number of ONE organization (every tenant has its own default). */
export async function findDefaultRow(organizationId) {
  if (!organizationId) return null;
  return prisma.whatsAppInstance.findFirst({
    where: { organizationId, isDefault: true },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Global lookup by key. Only for provider webhooks, where the number itself tells us which tenant
 * the event belongs to (`row.organizationId`). Request handlers must use `findInstanceRowForOrg`.
 * @param {string | null | undefined} key instance name (Evolution) or Green instance id
 */
export async function findInstanceRow(key) {
  if (!key) return null;
  return prisma.whatsAppInstance.findFirst({
    where: { OR: [{ instanceName: key }, { greenInstanceId: key }] },
  });
}

/** Tenant-checked lookup: a key that belongs to another organization is "not found". */
export async function findInstanceRowForOrg(key, organizationId) {
  if (!key || !organizationId) return null;
  return prisma.whatsAppInstance.findFirst({
    where: { organizationId, OR: [{ instanceName: key }, { greenInstanceId: key }] },
  });
}

/**
 * Database id + owning organization of the number a webhook belongs to
 * (Evolution instanceName or Green idInstance).
 * @returns {Promise<{ id: string, organizationId: string } | null>} null when the key matches no registered number
 */
export async function resolveInstance(key) {
  const row = await findInstanceRow(key);
  return row ? { id: row.id, organizationId: row.organizationId } : null;
}

/**
 * Key the messaging layer understands for a stored conversation's number
 * (Evolution instanceName, or the Green instance id for legacy rows). Undefined = default number.
 * @param {{ instanceId?: string | null, organizationId?: string }} lead
 */
export async function sendKeyForLead(lead) {
  if (!lead?.instanceId) return undefined;
  const row = await prisma.whatsAppInstance.findFirst({
    where: { id: lead.instanceId, ...(lead.organizationId ? { organizationId: lead.organizationId } : {}) },
  });
  if (!row) return undefined;
  return isLegacyGreenRow(row) ? row.greenInstanceId ?? undefined : row.instanceName;
}

/**
 * Migration helper: once an Evolution number is connected it replaces a legacy Green API
 * default (or a missing default), so agent replies and notifications leave from the new number.
 * Scoped to the number's own organization.
 * @returns {Promise<boolean>} true if the default changed
 */
export async function promoteDefaultIfLegacy(row) {
  if (!isEvolutionRow(row) || row.isDefault) return false;
  const current = await findDefaultRow(row.organizationId);
  if (current && !isLegacyGreenRow(current)) return false;
  await prisma.$transaction([
    prisma.whatsAppInstance.updateMany({ where: { organizationId: row.organizationId }, data: { isDefault: false } }),
    prisma.whatsAppInstance.update({ where: { id: row.id }, data: { isDefault: true } }),
  ]);
  return true;
}
