import { getAppSetting, setAppSetting } from './appSettings.js';
import { allPermissions, normalizePermissions } from '../lib/permissions.js';

const KEY = 'agent-access';
const CACHE_MS = 5000;

let cache = null; // { at, map }

/**
 * `instanceIds` = WhatsApp numbers (WhatsAppInstance.id) the agent may see and answer.
 *  - null  -> every number (default, also for agents created before this option existed)
 *  - [ids] -> only these numbers ([] = none)
 * @returns {Promise<Record<string, {active: boolean, permissions: Record<string, boolean>, instanceIds?: string[] | null}>>}
 */
export async function loadAccessMap() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.map;
  }
  const raw = await getAppSetting(KEY);
  const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  cache = { at: Date.now(), map };
  return map;
}

async function saveAccessMap(map) {
  await setAppSetting(KEY, map);
  cache = { at: Date.now(), map };
}

/** `undefined`/`null`/non-array => all numbers; array => unique string ids. */
export function normalizeInstanceIds(input) {
  if (!Array.isArray(input)) return null;
  return [...new Set(input.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))];
}

/** Can someone with this allow-list see a conversation of `leadInstanceId`? (null list = everything) */
export function canSeeInstance(instanceIds, leadInstanceId) {
  if (!Array.isArray(instanceIds)) return true;
  return Boolean(leadInstanceId) && instanceIds.includes(leadInstanceId);
}

/** Effective access for a user record (`{id, role}`). Admins can do everything. */
export async function getUserAccess(user) {
  if (user.role === 'ADMIN') {
    return { active: true, permissions: allPermissions(), instanceIds: null };
  }
  const map = await loadAccessMap();
  const entry = map[user.id];
  return {
    active: entry?.active !== false,
    permissions: normalizePermissions(entry?.permissions),
    instanceIds: normalizeInstanceIds(entry?.instanceIds),
  };
}

export async function setUserAccess(userId, { active, permissions, instanceIds }) {
  const map = { ...(await loadAccessMap()) };
  const current = map[userId] ?? {};
  map[userId] = {
    active: active === undefined ? current.active !== false : Boolean(active),
    permissions: permissions === undefined ? normalizePermissions(current.permissions) : normalizePermissions(permissions),
    instanceIds: instanceIds === undefined ? normalizeInstanceIds(current.instanceIds) : normalizeInstanceIds(instanceIds),
  };
  await saveAccessMap(map);
  return map[userId];
}

export async function removeUserAccess(userId) {
  const map = { ...(await loadAccessMap()) };
  if (userId in map) {
    delete map[userId];
    await saveAccessMap(map);
  }
}
