import * as greenApi from './greenApi.js';
import * as evolution from './evolutionService.js';
import { findDefaultRow, findInstanceRow, isLegacyGreenRow } from './whatsappInstanceStore.js';

/**
 * Provider-agnostic sending. The number a customer wrote to (`instance`) decides the provider:
 * Evolution API for numbers linked from the dashboard, Green API only for legacy rows.
 */

/** Green instance ids are numeric; webhook fallback markers look like "green-api". */
function looksLikeGreenKey(key) {
  return /^\d+$/.test(key) || key === 'green-api';
}

/**
 * @param {string | undefined} instanceKey
 * @returns {Promise<{ kind: 'evolution', instanceName: string } | { kind: 'green' }>}
 */
async function resolveBackend(instanceKey) {
  const row = instanceKey ? await findInstanceRow(instanceKey) : await findDefaultRow();

  if (row) {
    return isLegacyGreenRow(row) ? { kind: 'green' } : { kind: 'evolution', instanceName: row.instanceName };
  }

  // Key that matches no registered number (e.g. an instance created straight in the Evolution manager).
  if (instanceKey && !looksLikeGreenKey(instanceKey) && evolution.isEvolutionConfigured()) {
    return { kind: 'evolution', instanceName: instanceKey };
  }

  // No number registered at all: a single Green API configuration may still exist in settings/.env.
  if (!instanceKey && evolution.isEvolutionConfigured() && !greenApi.isGreenApiConfigured()) {
    const err = new Error('لا يوجد رقم واتساب مربوط — اربط رقماً من صفحة «ربط أرقام واتساب»');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return { kind: 'green' };
}

export async function sendWhatsAppText(params) {
  const backend = await resolveBackend(params.instance);
  if (backend.kind === 'green') return greenApi.sendWhatsAppText(params);
  return evolution.sendText(backend.instanceName, evolution.pickTarget(params), params.text);
}

export async function sendWhatsAppImage(params) {
  const backend = await resolveBackend(params.instance);
  if (backend.kind === 'green') return greenApi.sendWhatsAppImage(params);
  return evolution.sendImageByUrl(backend.instanceName, evolution.pickTarget(params), params.imageUrl, {
    fileName: params.fileName,
    caption: params.caption,
  });
}

/** Voice note from a public URL (agent recordings from the dashboard). */
export async function sendWhatsAppAudioFile(params) {
  const backend = await resolveBackend(params.instance);
  if (backend.kind === 'green') return greenApi.sendWhatsAppAudioFile(params);
  return evolution.sendVoiceNote(backend.instanceName, evolution.pickTarget(params), { url: params.audioUrl });
}

/** Voice note from raw audio (bot TTS replies). */
export async function sendWhatsAppAudio(params) {
  const backend = await resolveBackend(params.instance);
  if (backend.kind === 'green') return greenApi.sendWhatsAppAudio(params);
  return evolution.sendVoiceNote(backend.instanceName, evolution.pickTarget(params), {
    base64: params.audioBase64,
  });
}

export function getWhatsAppProvider() {
  return 'evolution';
}
