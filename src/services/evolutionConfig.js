import { getAiSettings, getEvolutionConfigFromSettings } from './platformSettings.js';
import { env } from '../config/env.js';

/**
 * Evolution credentials: dashboard (DB) first, then process.env fallback.
 */
export async function resolveEvolutionConfig() {
  const settings = await getAiSettings();
  const fromDb = await getEvolutionConfigFromSettings(settings);

  const envBase =
    env.evolutionBaseUrl?.trim().replace(/\/$/, '') ||
    process.env.EVOLUTION_BASE_URL?.trim().replace(/\/$/, '') ||
    '';
  const envKey =
    env.evolutionApiKey?.trim() || process.env.EVOLUTION_API_KEY?.trim() || '';
  const envInstance =
    env.evolutionInstance?.trim() || process.env.EVOLUTION_INSTANCE?.trim() || '';

  /** `.env` wins when set — avoids stale dashboard DB overriding deployment config */
  const baseUrl = envBase || fromDb.baseUrl?.trim().replace(/\/$/, '') || '';
  const apiKey = envKey || fromDb.apiKey?.trim() || '';

  return {
    baseUrl,
    apiKey,
    instance: envInstance || fromDb.instance?.trim() || '',
    webhookSecret:
      process.env.EVOLUTION_WEBHOOK_SECRET?.trim() || fromDb.webhookSecret?.trim() || '',
    appPublicUrl:
      process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '') ||
      fromDb.appPublicUrl?.trim().replace(/\/$/, '') ||
      '',
    configured: Boolean(baseUrl && apiKey),
    source: {
      baseUrl: envBase ? 'env' : fromDb.baseUrl?.trim() ? 'db' : 'none',
      apiKey: envKey ? 'env' : fromDb.apiKey?.trim() ? 'db' : 'none',
    },
  };
}
