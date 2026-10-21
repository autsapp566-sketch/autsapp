import { getAiSettings, updateAiSettings, serializeAiSettings } from './aiSettings.js';

export { getAiSettings, updateAiSettings, serializeAiSettings };

/** @param {import('@prisma/client').AiSettings} [row] */
export async function getAppPublicUrlFromSettings(row) {
  const settings = row ?? (await getAiSettings());
  return settings.appPublicUrl?.trim().replace(/\/$/, '') || '';
}
