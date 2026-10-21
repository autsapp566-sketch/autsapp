import { env } from '../config/env.js';
import { getAiSettings } from './aiSettings.js';

/** @type {{ instanceId: string, apiToken: string, baseUrl: string, configured: boolean, source: 'db' | 'env' | 'none' } | null} */
let cached = null;
let cacheExpiresAt = 0;
const CACHE_MS = 60_000;

function fromEnv() {
  const instanceId =
    env.greenApiInstanceId?.trim() || process.env.GREEN_API_INSTANCE_ID?.trim() || '';
  const apiToken = env.greenApiToken?.trim() || process.env.GREEN_API_TOKEN?.trim() || '';
  const baseUrl = (
    env.greenApiUrl?.trim() ||
    process.env.GREEN_API_URL?.trim() ||
    'https://api.green-api.com'
  ).replace(/\/$/, '');

  return {
    instanceId,
    apiToken,
    baseUrl,
    configured: Boolean(instanceId && apiToken && baseUrl),
    source: instanceId && apiToken ? 'env' : 'none',
  };
}

/**
 * @param {{ greenApiInstanceId?: string | null, greenApiToken?: string | null, greenApiUrl?: string | null } | null} row
 */
function mergeDbAndEnv(row) {
  const envCfg = fromEnv();
  const instanceId = row?.greenApiInstanceId?.trim() || envCfg.instanceId;
  const apiToken = row?.greenApiToken?.trim() || envCfg.apiToken;
  const baseUrl = (row?.greenApiUrl?.trim() || envCfg.baseUrl).replace(/\/$/, '');
  const fromDb = Boolean(
    row?.greenApiInstanceId?.trim() && row?.greenApiToken?.trim()
  );

  return {
    instanceId,
    apiToken,
    baseUrl,
    configured: Boolean(instanceId && apiToken && baseUrl),
    source: fromDb ? 'db' : envCfg.source,
  };
}

export function invalidateGreenApiConfigCache() {
  cached = null;
  cacheExpiresAt = 0;
}

/** Sync read — uses cache or .env only (use after refreshGreenApiConfigCache). */
export function resolveGreenApiConfig() {
  if (cached && Date.now() < cacheExpiresAt) {
    return cached;
  }
  return fromEnv();
}

/** Load DB + env into cache (call on boot and after saving settings). */
export async function refreshGreenApiConfigCache() {
  const row = await getAiSettings();
  cached = mergeDbAndEnv(row);
  cacheExpiresAt = Date.now() + CACHE_MS;
  return cached;
}

export async function resolveGreenApiConfigAsync() {
  if (cached && Date.now() < cacheExpiresAt) {
    return cached;
  }
  return refreshGreenApiConfigCache();
}
