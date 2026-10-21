import OpenAI from 'openai';
import { getAiSettings } from './aiSettings.js';

let cachedKey = null;
/** @type {OpenAI | null} */
let client = null;

export async function resolveOpenAiApiKey() {
  const settings = await getAiSettings();
  return settings.openAiApiKey?.trim() || '';
}

export async function getOpenAIClient() {
  const key = await resolveOpenAiApiKey();
  if (!key) {
    throw new Error('مفتاح OpenAI غير مضبوط — أضفه من إعدادات الصوت والذكاء');
  }
  if (cachedKey !== key) {
    client = new OpenAI({ apiKey: key });
    cachedKey = key;
  }
  return client;
}

export function invalidateOpenAIClientCache() {
  cachedKey = null;
  client = null;
}
