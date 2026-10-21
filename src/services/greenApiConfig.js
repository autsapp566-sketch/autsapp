import { env } from '../config/env.js';

/**
 * @returns {{
 *   instanceId: string,
 *   apiToken: string,
 *   baseUrl: string,
 *   configured: boolean,
 * }}
 */
export function resolveGreenApiConfig() {
  const instanceId =
    env.greenApiInstanceId?.trim() || process.env.GREEN_API_INSTANCE_ID?.trim() || '';
  const apiToken =
    env.greenApiToken?.trim() || process.env.GREEN_API_TOKEN?.trim() || '';
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
  };
}
