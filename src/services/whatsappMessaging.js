import { env } from '../config/env.js';
import { isGreenApiConfigured } from './greenApi.js';
import * as greenApi from './greenApi.js';
import * as evolutionApi from './evolutionApi.js';

function useGreenApi() {
  const provider = (env.whatsappProvider || process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
  if (provider === 'green' || provider === 'green-api') {
    return true;
  }
  if (provider === 'evolution') {
    return false;
  }
  return isGreenApiConfigured();
}

export async function sendWhatsAppText(params) {
  if (useGreenApi()) {
    return greenApi.sendWhatsAppText(params);
  }
  return evolutionApi.sendWhatsAppText(params);
}

export async function sendWhatsAppAudio(params) {
  if (useGreenApi()) {
    return greenApi.sendWhatsAppAudio(params);
  }
  return evolutionApi.sendWhatsAppAudio(params);
}

export function getWhatsAppProvider() {
  return useGreenApi() ? 'green-api' : 'evolution';
}
