import { phoneFromRemoteJid } from '../lib/evolutionPayload.js';
import { prisma } from '../lib/prisma.js';
import { resolveEvolutionConfig } from './evolutionConfig.js';
import {
  enableEvolutionMockMode,
  isEvolutionMockMode,
  mockEvolutionRequest,
  mockSendMessageResponse,
} from './evolutionMockMode.js';

export async function getEvolutionConfig() {
  return resolveEvolutionConfig();
}

const EVOLUTION_FETCH_MS = 12_000;

/**
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function evolutionRequest(path, options = {}) {
  if (isEvolutionMockMode()) {
    return mockEvolutionRequest(path, options);
  }

  const { baseUrl, apiKey, configured } = await getEvolutionConfig();
  if (!configured) {
    enableEvolutionMockMode('Evolution not configured (env or DB)');
    return mockEvolutionRequest(path, options);
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(EVOLUTION_FETCH_MS),
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (err) {
    const error = new Error(
      `تعذر الاتصال بـ Evolution (${baseUrl}): ${err?.message ?? 'network/timeout'}`
    );
    error.cause = err;
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      (Array.isArray(body.response?.message) ? body.response.message.join(', ') : null) ??
      body.message ??
      body.error ??
      response.statusText;
    throw new Error(typeof detail === 'string' ? detail : `Evolution API HTTP ${response.status}`);
  }

  return body;
}

export function extractQrFromEvolutionResponse(data) {
  if (!data) {
    return { base64: null, pairingCode: null };
  }

  if (typeof data === 'string') {
    const base64 = data.startsWith('data:image') ? data : `data:image/png;base64,${data}`;
    return { base64, pairingCode: null };
  }

  if (typeof data !== 'object') {
    return { base64: null, pairingCode: null };
  }

  const nested = data.qrcode ?? data.qrCode ?? data.instance?.qrcode ?? data.data?.qrcode ?? {};
  let base64 =
    data.base64 ??
    nested.base64 ??
    nested.base64Image ??
    nested.image ??
    data.qr ??
    data.image ??
    nested.qr ??
    (typeof nested.code === 'string' && nested.code.startsWith('data:image') ? nested.code : null) ??
    (typeof data.code === 'string' && data.code.startsWith('data:image') ? data.code : null);

  if (!base64 && typeof nested.code === 'string' && nested.code.length > 100 && !nested.code.includes(' ')) {
    base64 = nested.code;
  }
  if (!base64 && typeof data.code === 'string' && data.code.length > 100 && !data.code.includes(' ')) {
    base64 = data.code;
  }

  if (typeof base64 === 'string' && base64 && !base64.startsWith('data:image')) {
    base64 = `data:image/png;base64,${base64}`;
  }

  const pairingCode = data.pairingCode ?? nested.pairingCode ?? data.codePairing ?? null;

  return { base64: base64 || null, pairingCode };
}

export async function fetchConnectQr(instanceName) {
  const connect = await connectEvolutionInstance(instanceName);
  let qr = extractQrFromEvolutionResponse(connect);
  if (!qr.base64) {
    const state = await getEvolutionConnectionState(instanceName).catch(() => null);
    qr = extractQrFromEvolutionResponse(state);
  }
  return qr;
}

export async function fetchEvolutionInstances() {
  return evolutionRequest('/instance/fetchInstances', { method: 'GET' });
}

export async function getEvolutionConnectionState(instanceName) {
  return evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`, {
    method: 'GET',
  });
}

export async function connectEvolutionInstance(instanceName) {
  return evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`, { method: 'GET' });
}

/**
 * @param {{ instanceName: string, webhookUrl?: string }} params
 */
export async function createEvolutionInstance({ instanceName, webhookUrl }) {
  const payload = {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    groupsIgnore: true,
  };

  if (webhookUrl) {
    payload.webhook = {
      url: webhookUrl,
      enabled: true,
      webhookByEvents: false,
      webhookBase64: false,
      events: ['MESSAGES_UPSERT'],
    };
  }

  return evolutionRequest('/instance/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteEvolutionInstance(instanceName) {
  return evolutionRequest(`/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: 'DELETE',
  });
}

export function normalizeConnectionState(raw) {
  const state =
    raw?.instance?.state ??
    raw?.state ??
    raw?.status ??
    raw?.connectionStatus ??
    'unknown';
  return String(state).toLowerCase();
}

export async function resolveInstanceName(instance) {
  if (instance) {
    return instance;
  }
  const { instance: defaultInstance } = await getEvolutionConfig();
  if (defaultInstance) {
    return defaultInstance;
  }
  const def = await prisma.whatsAppInstance.findFirst({
    where: { isDefault: true },
    orderBy: { updatedAt: 'desc' },
  });
  return def?.instanceName ?? '';
}

/**
 * @param {{ phone: string, audioBase64: string, instance?: string }} params
 */
export async function sendWhatsAppAudio({ phone, audioBase64, instance }) {
  const instanceName = await resolveInstanceName(instance);

  if (!instanceName && !isEvolutionMockMode()) {
    throw new Error('No WhatsApp instance configured');
  }

  if (isEvolutionMockMode()) {
    return mockSendMessageResponse({
      phone,
      text: `[audio ${audioBase64?.length ?? 0} bytes]`,
      kind: 'Audio',
    });
  }

  const { baseUrl, apiKey } = await getEvolutionConfig();
  const url = `${baseUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(EVOLUTION_FETCH_MS),
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: phone,
        audio: audioBase64,
      }),
    });
  } catch (err) {
    throw new Error(`Evolution sendWhatsAppAudio failed: ${err?.message ?? 'network'}`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? 'Evolution sendWhatsAppAudio HTTP error');
  }

  return body;
}

export async function sendWhatsAppText({ remoteJid, phone, text, instance }) {
  const instanceName = await resolveInstanceName(instance);
  const number = phone ?? (remoteJid ? phoneFromRemoteJid(remoteJid) : '');

  if (!number) {
    throw new Error('Cannot send WhatsApp message: missing phone number');
  }

  if (isEvolutionMockMode()) {
    return mockSendMessageResponse({ phone: number, text, kind: 'Text' });
  }

  if (!instanceName) {
    throw new Error('لا يوجد instance واتساب — اضبط Evolution من لوحة التحكم');
  }

  const { baseUrl, apiKey } = await getEvolutionConfig();
  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(EVOLUTION_FETCH_MS),
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number,
        text: text.slice(0, 4096),
      }),
    });
  } catch (err) {
    throw new Error(`Evolution sendText failed: ${err?.message ?? 'network'}`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? 'Evolution sendText HTTP error');
  }

  return body;
}

export { isEvolutionMockMode } from './evolutionMockMode.js';
