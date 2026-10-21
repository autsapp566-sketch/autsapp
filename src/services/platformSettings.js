import { getAiSettings, updateAiSettings, serializeAiSettings } from './aiSettings.js';

export { getAiSettings, updateAiSettings, serializeAiSettings };

/** @param {import('@prisma/client').AiSettings} row */
export async function getEvolutionConfigFromSettings(row) {
  const settings = row ?? (await getAiSettings());
  const baseUrl = settings.evolutionBaseUrl?.trim().replace(/\/$/, '') || '';
  const apiKey = settings.evolutionApiKey?.trim() || '';
  return {
    baseUrl,
    apiKey,
    instance: settings.evolutionInstance?.trim() || '',
    webhookSecret: settings.evolutionWebhookSecret?.trim() || '',
    appPublicUrl: settings.appPublicUrl?.trim().replace(/\/$/, '') || '',
  };
}
