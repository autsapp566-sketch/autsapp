import * as greenApi from './greenApi.js';
import * as evolution from './evolutionService.js';
import { findDefaultRow, findInstanceRow, findInstanceRowForOrg, isLegacyGreenRow } from './whatsappInstanceStore.js';

/**
 * Provider-agnostic sending, always bound to ONE organization.
 * The number a customer wrote to (`instance`) decides the provider: Evolution API for numbers linked
 * from the dashboard, Green API only for legacy rows. A number of another organization can never be
 * used: `organizationId` is mandatory and every lookup is tenant-checked.
 */

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

/**
 * @param {string | undefined} instanceKey instance name / Green id; undefined = the organization's default number
 * @param {string} organizationId
 * @returns {Promise<{ kind: 'evolution', instanceName: string } | { kind: 'green', instanceKey: string }>}
 */
async function resolveBackend(instanceKey, organizationId) {
  if (!organizationId) {
    throw httpError(500, 'organizationId is required to send a WhatsApp message');
  }

  const row = instanceKey
    ? await findInstanceRowForOrg(instanceKey, organizationId)
    : await findDefaultRow(organizationId);

  if (row) {
    return isLegacyGreenRow(row)
      ? { kind: 'green', instanceKey: row.greenInstanceId ?? row.instanceName }
      : { kind: 'evolution', instanceName: row.instanceName };
  }

  if (instanceKey && (await findInstanceRow(instanceKey))) {
    throw httpError(403, 'هذا الرقم لا ينتمي إلى مؤسستك');
  }
  throw httpError(400, 'لا يوجد رقم واتساب مربوط — اربط رقماً من صفحة «ربط أرقام واتساب»');
}

export async function sendWhatsAppText(params) {
  const backend = await resolveBackend(params.instance, params.organizationId);
  if (backend.kind === 'green') return greenApi.sendWhatsAppText({ ...params, instance: backend.instanceKey });
  return evolution.sendText(backend.instanceName, evolution.pickTarget(params), params.text);
}

export async function sendWhatsAppImage(params) {
  const backend = await resolveBackend(params.instance, params.organizationId);
  if (backend.kind === 'green') return greenApi.sendWhatsAppImage({ ...params, instance: backend.instanceKey });
  return evolution.sendImageByUrl(backend.instanceName, evolution.pickTarget(params), params.imageUrl, {
    fileName: params.fileName,
    caption: params.caption,
  });
}

/** Voice note from a public URL (agent recordings from the dashboard). */
export async function sendWhatsAppAudioFile(params) {
  const backend = await resolveBackend(params.instance, params.organizationId);
  if (backend.kind === 'green') return greenApi.sendWhatsAppAudioFile({ ...params, instance: backend.instanceKey });
  return evolution.sendVoiceNote(backend.instanceName, evolution.pickTarget(params), { url: params.audioUrl });
}

/** Voice note from raw audio (bot TTS replies). */
export async function sendWhatsAppAudio(params) {
  const backend = await resolveBackend(params.instance, params.organizationId);
  if (backend.kind === 'green') return greenApi.sendWhatsAppAudio({ ...params, instance: backend.instanceKey });
  return evolution.sendVoiceNote(backend.instanceName, evolution.pickTarget(params), {
    base64: params.audioBase64,
  });
}

export function getWhatsAppProvider() {
  return 'evolution';
}
