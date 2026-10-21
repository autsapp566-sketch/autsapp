import * as greenApi from './greenApi.js';

export async function sendWhatsAppText(params) {
  return greenApi.sendWhatsAppText(params);
}

export async function sendWhatsAppImage(params) {
  return greenApi.sendWhatsAppImage(params);
}

export async function sendWhatsAppAudio(params) {
  return greenApi.sendWhatsAppAudio(params);
}

export function getWhatsAppProvider() {
  return 'green-api';
}
