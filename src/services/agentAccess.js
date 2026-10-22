import { getAppSetting, setAppSetting } from './appSettings.js';
import { allPermissions, normalizePermissions } from '../lib/permissions.js';

const KEY = 'agent-access';
const CACHE_MS = 5000;

let cache = null; // { at, map }

/** @returns {Promise<Record<string, {active: boolean, permissions: Record<string, boolean>}>>} */
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

/** Effective access for a user record (`{id, role}`). Admins can do everything. */
export async function getUserAccess(user) {
  if (user.role === 'ADMIN') {
    return { active: true, permissions: allPermissions() };
  }
  const map = await loadAccessMap();
  const entry = map[user.id];
  return {
    active: entry?.active !== false,
    permissions: normalizePermissions(entry?.permissions),
  };
}

export async function setUserAccess(userId, { active, permissions }) {
  const map = { ...(await loadAccessMap()) };
  const current = map[userId] ?? {};
  map[userId] = {
    active: active === undefined ? current.active !== false : Boolean(active),
    permissions: permissions === undefined ? normalizePermissions(current.permissions) : normalizePermissions(permissions),
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
