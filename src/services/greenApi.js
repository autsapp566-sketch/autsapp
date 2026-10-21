import { prisma } from '../lib/prisma.js';
import { resolveGreenApiConfig } from './greenApiConfig.js';

const FETCH_MS = 15_000;
const STATE_CACHE_MS = 8_000;
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_WAIT_MS = 2_500;

/** @type {Map<string, { value: { state: string, raw: unknown }, expires: number }>} */
const stateInstanceCache = new Map();

/**
 * @typedef {{ instanceId: string, apiToken: string, baseUrl: string, configured: boolean }} GreenCredentials
 */

/**
 * @param {{ greenInstanceId?: string | null, greenApiToken?: string | null, greenApiUrl?: string | null } | null} [row]
 * @returns {GreenCredentials}
 */
export function resolveGreenCredentials(row = null) {
  const envCfg = resolveGreenApiConfig();
  const instanceId = row?.greenInstanceId?.trim() || envCfg.instanceId;
  const apiToken = row?.greenApiToken?.trim() || envCfg.apiToken;
  const baseUrl = (row?.greenApiUrl?.trim() || envCfg.baseUrl).replace(/\/$/, '');

  return {
    instanceId,
    apiToken,
    baseUrl,
    configured: Boolean(instanceId && apiToken && baseUrl),
  };
}

/**
 * @param {GreenCredentials} creds
 * @param {string} pathSuffix e.g. "sendMessage" or "qr"
 * @param {RequestInit} [init]
 */
function formatGreenHttpError(status, body, statusText) {
  if (status === 429) {
    return 'Green API: طلبات كثيرة — انتظر 3–5 ثوانٍ ثم أعد المحاولة';
  }
  const quotaText = body?.correspondentsStatus?.description ?? body?.invokeStatus?.description;
  if (status === 466 || (typeof quotaText === 'string' && quotaText.trim())) {
    const allowed = /numbers:\s*([^\s][^.]*?)\.\s/i.exec(`${quotaText ?? ''} `)?.[1];
    return (
      'حصة Green API مستنفدة: خطة Developer تسمح بالمراسلة مع 3 أرقام فقط. ' +
      'رقّ الخطة إلى Business من console.green-api.com.' +
      (allowed ? ` الأرقام المسموح بها: ${allowed.replace(/@c\.us/g, '')}` : '')
    );
  }
  const detail = body?.message ?? body?.error ?? body?.reason;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    return JSON.stringify(body);
  }
  return statusText?.trim() || `Green API HTTP ${status}`;
}

async function greenApiRequest(creds, pathSuffix, init = {}, attempt = 0) {
  if (!creds.configured) {
    const err = new Error('Green API credentials missing (Instance ID / API Token / URL)');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  const url = `${creds.baseUrl}/waInstance${creds.instanceId}/${pathSuffix}/${creds.apiToken}`;
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = { ...(init.headers ?? {}) };
  if (method !== 'GET' && method !== 'HEAD' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, {
      ...init,
      method,
      signal: init.signal ?? AbortSignal.timeout(FETCH_MS),
      headers,
    });
  } catch (err) {
    const error = new Error(`Green API request failed: ${err?.message ?? 'network error'}`);
    error.status = 502;
    error.expose = true;
    throw error;
  }

  if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS));
    return greenApiRequest(creds, pathSuffix, init, attempt + 1);
  }

  const body = await response.json().catch(() => ({}));
  const type = typeof body?.type === 'string' ? body.type.toLowerCase() : '';

  if (type === 'error' || type === 'apicalerror' || type === 'apicallerror') {
    const error = new Error(body.message ?? body.reason ?? 'Green API returned an error');
    error.status = 502;
    error.expose = true;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(formatGreenHttpError(response.status, body, response.statusText));
    error.status = response.status === 429 ? 429 : 502;
    error.expose = true;
    if (response.status === 466) {
      error.quota = true;
    }
    throw error;
  }

  return body;
}

/**
 * @param {unknown} data
 */
export function extractQrFromGreenResponse(data) {
  if (!data || typeof data !== 'object') {
    return { base64: null, pairingCode: null, message: null };
  }

  const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
  if (type === 'alreadylogged' || type === 'error') {
    return {
      base64: null,
      pairingCode: null,
      message: data.message ?? 'Instance already authorized — no QR needed',
    };
  }

  let raw =
    data.message ??
    data.qrCode ??
    data.base64 ??
    data.data ??
    (typeof data.code === 'string' ? data.code : null);

  if (typeof raw !== 'string' || !raw.trim()) {
    return { base64: null, pairingCode: data.pairingCode ?? null, message: null };
  }

  raw = raw.trim();
  if (/already logged|already authorized|instance already/i.test(raw)) {
    return { base64: null, pairingCode: null, message: raw };
  }

  const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(raw.replace(/^data:image\/[^;]+;base64,/, ''));
  if (!raw.startsWith('data:image') && !looksLikeBase64) {
    return { base64: null, pairingCode: null, message: raw };
  }

  let base64 = raw.startsWith('data:image') ? raw : `data:image/png;base64,${raw}`;

  return { base64, pairingCode: data.pairingCode ?? null, message: null };
}

/**
 * @param {GreenCredentials} creds
 */
export async function getQrCode(creds) {
  const body = await greenApiRequest(creds, 'qr', { method: 'GET' });
  return extractQrFromGreenResponse(body);
}

/**
 * @param {string} stateInstance
 */
export function normalizeGreenState(stateInstance) {
  const s = String(stateInstance ?? '').toLowerCase();
  if (s === 'authorized') {
    return 'authorized';
  }
  if (s === 'notauthorized' || s === 'not_authorized') {
    return 'notAuthorized';
  }
  if (s === 'blocked') {
    return 'blocked';
  }
  if (s === 'starting') {
    return 'starting';
  }
  if (s === 'sleepmode' || s === 'sleep_mode') {
    return 'sleepMode';
  }
  return s || 'unknown';
}

/**
 * @param {GreenCredentials} creds
 */
export async function getStateInstance(creds) {
  const cacheKey = `${creds.baseUrl}:${creds.instanceId}`;
  const cached = stateInstanceCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const body = await greenApiRequest(creds, 'getStateInstance', { method: 'GET' });
  const state = normalizeGreenState(body.stateInstance ?? body.state);
  const value = { state, raw: body };
  stateInstanceCache.set(cacheKey, { value, expires: Date.now() + STATE_CACHE_MS });
  return value;
}

export function invalidateGreenStateCache(creds) {
  if (!creds?.instanceId) {
    stateInstanceCache.clear();
    return;
  }
  const cacheKey = `${creds.baseUrl}:${creds.instanceId}`;
  stateInstanceCache.delete(cacheKey);
}

export function isGreenConnectedState(state) {
  const s = normalizeGreenState(state);
  return s === 'authorized';
}

/**
 * Current Green API instance settings (webhookUrl, incomingWebhook, ...).
 * @param {GreenCredentials} creds
 */
export async function getGreenSettings(creds) {
  return greenApiRequest(creds, 'getSettings', { method: 'GET' });
}

/**
 * Point Green API at our webhook and enable incoming message notifications.
 * Note: Green applies new settings after an automatic instance restart (up to a few minutes).
 * @param {GreenCredentials} creds
 * @param {string} webhookUrl
 */
export async function setGreenWebhook(creds, webhookUrl) {
  return greenApiRequest(creds, 'setSettings', {
    method: 'POST',
    body: JSON.stringify({
      webhookUrl,
      webhookUrlToken: '',
      incomingWebhook: 'yes',
      editedMessageWebhook: 'yes',
      outgoingWebhook: 'no',
      outgoingMessageWebhook: 'no',
      outgoingAPIMessageWebhook: 'no',
      stateWebhook: 'no',
      deviceWebhook: 'no',
    }),
  });
}

/**
 * @param {GreenCredentials} creds
 */
export async function logoutInstance(creds) {
  return greenApiRequest(creds, 'logout', { method: 'GET' });
}

/**
 * @param {GreenCredentials} creds
 */
export async function rebootInstance(creds) {
  return greenApiRequest(creds, 'reboot', { method: 'GET' });
}

/**
 * Normalize phone or chat id to Green API chatId (individual chats).
 * @param {string} phoneOrChatId
 */
export function toGreenApiChatId(phoneOrChatId) {
  const raw = String(phoneOrChatId ?? '').trim();
  if (!raw) {
    throw new Error('Phone number is required');
  }
  if (raw.includes('@')) {
    return raw;
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Invalid phone number');
  }
  return `${digits}@c.us`;
}

/**
 * @param {string} phoneOrChatId
 * @param {string} message
 * @param {GreenCredentials} [creds]
 */
export async function sendMessage(phoneOrChatId, message, creds) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) {
    throw new Error('Message content is required');
  }

  const credentials = creds ?? resolveGreenCredentials();
  if (!credentials.configured) {
    throw new Error(
      'Green API غير مضبوط — أضف Instance ID و API Token (في النموذج أو .env)'
    );
  }

  const chatId = toGreenApiChatId(phoneOrChatId);
  const body = await greenApiRequest(credentials, 'sendMessage', {
    method: 'POST',
    body: JSON.stringify({ chatId, message: text.slice(0, 4096) }),
  });

  return {
    status: 'success',
    messageId: body.idMessage ?? body.messageId ?? null,
    provider: 'green-api',
    raw: body,
  };
}

/**
 * Send an image (or any file) by public URL — shown as a real WhatsApp image, not a link.
 * @param {string} phoneOrChatId
 * @param {string} imageUrl
 * @param {GreenCredentials} [creds]
 * @param {{ fileName?: string, caption?: string }} [opts]
 */
export async function sendImageByUrl(phoneOrChatId, imageUrl, creds, opts = {}) {
  const credentials = creds ?? resolveGreenCredentials();
  if (!credentials.configured) {
    throw new Error('Green API غير مضبوط — أضف Instance ID و API Token');
  }
  const body = await greenApiRequest(credentials, 'sendFileByUrl', {
    method: 'POST',
    body: JSON.stringify({
      chatId: toGreenApiChatId(phoneOrChatId),
      urlFile: imageUrl,
      fileName: opts.fileName ?? 'image.jpg',
      ...(opts.caption ? { caption: opts.caption.slice(0, 1024) } : {}),
    }),
  });
  return { status: 'success', messageId: body.idMessage ?? null, provider: 'green-api', raw: body };
}

/**
 * @param {string} [instanceKey] instanceName or greenInstanceId
 */
export async function resolveGreenCredentialsByInstanceKey(instanceKey) {
  if (!instanceKey) {
    const def = await prisma.whatsAppInstance.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
    return resolveGreenCredentials(def);
  }

  const row = await prisma.whatsAppInstance.findFirst({
    where: {
      OR: [{ instanceName: instanceKey }, { greenInstanceId: instanceKey }],
    },
  });
  return resolveGreenCredentials(row);
}

/**
 * @param {{ phone?: string, remoteJid?: string, text: string, instance?: string }} params
 */
export async function sendWhatsAppText({ phone, remoteJid, text, instance }) {
  const creds = await resolveGreenCredentialsByInstanceKey(instance);
  const target = phone ?? remoteJid ?? '';
  return sendMessage(target, text, creds);
}

/**
 * @param {{ phone?: string, remoteJid?: string, imageUrl: string, instance?: string, fileName?: string, caption?: string }} params
 */
export async function sendWhatsAppImage({ phone, remoteJid, imageUrl, instance, fileName, caption }) {
  const creds = await resolveGreenCredentialsByInstanceKey(instance);
  return sendImageByUrl(phone ?? remoteJid ?? '', imageUrl, creds, { fileName, caption });
}

/**
 * Send an audio file by public URL — Green API delivers audio files as native WhatsApp audio.
 * @param {{ phone?: string, remoteJid?: string, audioUrl: string, instance?: string, fileName?: string }} params
 */
export async function sendWhatsAppAudioFile({ phone, remoteJid, audioUrl, instance, fileName }) {
  const creds = await resolveGreenCredentialsByInstanceKey(instance);
  if (!creds.configured) {
    throw new Error('Green API غير مضبوط — أضف Instance ID و API Token');
  }
  const body = await greenApiRequest(creds, 'sendFileByUrl', {
    method: 'POST',
    body: JSON.stringify({
      chatId: toGreenApiChatId(phone ?? remoteJid ?? ''),
      urlFile: audioUrl,
      fileName: fileName ?? 'voice.mp3',
    }),
  });
  return { status: 'success', messageId: body.idMessage ?? null, provider: 'green-api', raw: body };
}

export async function sendWhatsAppAudio({ phone, audioBase64 }) {
  void phone;
  void audioBase64;
  throw new Error('Green API: إرسال الصوت غير مُنفّذ بعد — عطّل TTS أو استخدم النص فقط');
}

export function isGreenApiConfigured() {
  return resolveGreenApiConfig().configured;
}

export function maskGreenToken(token) {
  if (!token) {
    return '';
  }
  const t = String(token);
  if (t.length <= 8) {
    return '••••';
  }
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
