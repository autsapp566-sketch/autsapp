import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Evolution API v2 client.
 * Auth: one global key sent in the `apikey` header. Every WhatsApp number is an "instance"
 * identified by its name (stored in WhatsAppInstance.instanceName).
 */

const FETCH_MS = 20_000;
const STATE_CACHE_MS = 6_000;

/** Events we want delivered to our webhook. */
export const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_EDITED', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];
const WEBHOOK_EVENTS_BASIC = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

export const WEBHOOK_PATH = '/api/webhook/evolution';

/** @type {Map<string, { value: { state: string, raw: unknown }, expires: number }>} */
const stateCache = new Map();

/* ------------------------------------------------------------------ config */

export function getEvolutionConfig() {
  const baseUrl = env.evolutionApiUrl || process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '') || '';
  const apiKey = env.evolutionApiKey || process.env.EVOLUTION_API_KEY?.trim() || '';
  return { baseUrl, apiKey, configured: Boolean(baseUrl && apiKey) };
}

export function isEvolutionConfigured() {
  return getEvolutionConfig().configured;
}

export function maskEvolutionKey(key) {
  const k = String(key ?? '');
  if (!k) return '';
  return k.length <= 8 ? '••••' : `${k.slice(0, 3)}…${k.slice(-3)}`;
}

/** Secret carried in the webhook URL so only our own Evolution server can post to it. */
export function evolutionWebhookToken() {
  return createHmac('sha256', env.jwtSecret).update('evolution-webhook').digest('hex').slice(0, 32);
}

export function buildEvolutionWebhookUrl(base) {
  const root = String(base ?? '').trim().replace(/\/+$/, '');
  if (!root) return null;
  return `${root}${WEBHOOK_PATH}?token=${evolutionWebhookToken()}`;
}

/* ------------------------------------------------------------------ http */

function evolutionError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  Object.assign(error, extra);
  return error;
}

/** Evolution returns `{ response: { message: [..] } }`, `{ message }` or `{ error }`. */
function extractErrorDetail(body) {
  const candidates = [body?.response?.message, body?.message, body?.response?.error, body?.error];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' — ');
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function formatHttpError(status, body, statusText) {
  const detail = extractErrorDetail(body);
  if (status === 401) {
    return 'Evolution API: مفتاح EVOLUTION_API_KEY غير صحيح';
  }
  if (status >= 500) {
    if (/table .* does not exist|relation .* does not exist/i.test(detail)) {
      return 'Evolution API: جداول قاعدة بيانات الخادم غير موجودة — شغّل migrations على خادم Evolution (npm run db:deploy أو أعد تشغيل الحاوية مع DATABASE_PROVIDER=postgresql)';
    }
    const short = detail.replace(/\s+/g, ' ').slice(-200);
    return `Evolution API خطأ داخلي في الخادم (${status})${short ? `: ${short}` : ' — تحقق من قاعدة بيانات Evolution وسجلاته'}`;
  }
  return detail || statusText?.trim() || `Evolution API HTTP ${status}`;
}

/**
 * @param {string} path e.g. "/instance/create"
 * @param {{ method?: string, body?: unknown, query?: Record<string, string | undefined>, auth?: boolean }} [opts]
 */
export async function evolutionRequest(path, opts = {}) {
  const cfg = getEvolutionConfig();
  if (!cfg.configured) {
    throw evolutionError('Evolution API غير مضبوط — أضف EVOLUTION_API_URL و EVOLUTION_API_KEY في .env', 400);
  }

  const url = new URL(`${cfg.baseUrl}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  const method = (opts.method ?? 'GET').toUpperCase();
  const headers = { apikey: cfg.apiKey };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(FETCH_MS),
    });
  } catch (err) {
    throw evolutionError(`تعذر الاتصال بـ Evolution API (${cfg.baseUrl}): ${err?.message ?? 'network error'}`, 502);
  }

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 300) };
  }

  if (!response.ok) {
    // Never forward 401/5xx as-is: the dashboard would read 401 as "session expired".
    const status = response.status === 401 || response.status >= 500 ? 502 : response.status;
    throw evolutionError(formatHttpError(response.status, body, response.statusText), status, {
      evolutionStatus: response.status,
    });
  }
  return body;
}

/** Server banner (no auth needed): version + reachability. Never throws. */
export async function pingEvolution() {
  const cfg = getEvolutionConfig();
  if (!cfg.baseUrl) return { reachable: false, version: null, error: 'EVOLUTION_API_URL غير مضبوط' };
  try {
    const res = await fetch(`${cfg.baseUrl}/`, { signal: AbortSignal.timeout(6000) });
    const body = await res.json().catch(() => ({}));
    return { reachable: res.ok, version: body?.version ?? null, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { reachable: false, version: null, error: err?.message ?? 'unreachable' };
  }
}

/** Checks the API key against an authenticated endpoint. Never throws. */
export async function verifyEvolutionKey() {
  try {
    // Unfiltered list: also exercises Evolution's database, so a broken DB shows up here.
    await evolutionRequest('/instance/fetchInstances').catch((err) => {
      if (err.evolutionStatus === 404) return null; // some builds answer 404 for an empty list
      throw err;
    });
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ------------------------------------------------------------------ instances */

const enc = encodeURIComponent;

/**
 * Create an instance (Baileys). If the name already exists on the server it is adopted.
 * @returns {Promise<{ created: boolean, qr: ReturnType<typeof extractQr> }>}
 */
export async function createInstance({ instanceName, number }) {
  try {
    const body = await evolutionRequest('/instance/create', {
      method: 'POST',
      body: {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        groupsIgnore: true,
        ...(number ? { number } : {}),
      },
    });
    return { created: true, qr: extractQr(body?.qrcode ?? body) };
  } catch (err) {
    // 403 "This name is already in use" => adopt the existing instance.
    if (err.evolutionStatus === 403 && /already in use|exist/i.test(err.message)) {
      return { created: false, qr: extractQr(null) };
    }
    throw err;
  }
}

export function normalizeEvolutionState(state) {
  const s = String(state ?? '').toLowerCase();
  if (s === 'open' || s === 'connecting' || s === 'close') return s;
  return s || 'unknown';
}

export function isEvolutionConnectedState(state) {
  return normalizeEvolutionState(state) === 'open';
}

export function invalidateEvolutionStateCache(instanceName) {
  if (instanceName) stateCache.delete(instanceName);
  else stateCache.clear();
}

export async function getConnectionState(instanceName) {
  const cached = stateCache.get(instanceName);
  if (cached && cached.expires > Date.now()) return cached.value;

  const body = await evolutionRequest(`/instance/connectionState/${enc(instanceName)}`);
  const value = { state: normalizeEvolutionState(body?.instance?.state ?? body?.state), raw: body };
  stateCache.set(instanceName, { value, expires: Date.now() + STATE_CACHE_MS });
  return value;
}

/** Remember a state we learnt from a webhook (so the dashboard reflects it immediately). */
export function rememberConnectionState(instanceName, state) {
  stateCache.set(instanceName, {
    value: { state: normalizeEvolutionState(state), raw: { source: 'webhook' } },
    expires: Date.now() + STATE_CACHE_MS,
  });
}

/**
 * @param {unknown} data response of /instance/connect or the `qrcode` object of /instance/create
 * @returns {{ base64: string | null, pairingCode: string | null, code: string | null, message: string | null }}
 */
export function extractQr(data) {
  if (!data || typeof data !== 'object') {
    return { base64: null, pairingCode: null, code: null, message: null };
  }
  const raw = typeof data.base64 === 'string' ? data.base64.trim() : '';
  const base64 = raw ? (raw.startsWith('data:image') ? raw : `data:image/png;base64,${raw}`) : null;
  return {
    base64,
    pairingCode: typeof data.pairingCode === 'string' && data.pairingCode ? data.pairingCode : null,
    code: typeof data.code === 'string' && data.code ? data.code : null,
    message: null,
  };
}

/** QR / pairing code for linking. Pass `number` to get an 8-letter pairing code instead of scanning. */
export async function connectInstance(instanceName, number) {
  const body = await evolutionRequest(`/instance/connect/${enc(instanceName)}`, {
    query: { number: number ? String(number).replace(/\D/g, '') : undefined },
  });
  if (body?.instance?.state === 'open') {
    return { connected: true, qr: { base64: null, pairingCode: null, code: null, message: 'WhatsApp متصل — لا حاجة لـ QR.' } };
  }
  const qr = extractQr(body);
  if (!qr.base64 && !qr.pairingCode) {
    qr.message = 'QR غير جاهز بعد — أعد المحاولة بعد ثوانٍ';
  }
  return { connected: false, qr };
}

/** Owner phone / profile of an instance (best effort). */
export async function fetchInstanceInfo(instanceName) {
  const body = await evolutionRequest('/instance/fetchInstances', { query: { instanceName } });
  const item = Array.isArray(body) ? body[0] : body;
  const jid = item?.ownerJid ?? item?.instance?.owner ?? item?.owner ?? '';
  const phone = String(jid).split('@')[0].replace(/\D/g, '');
  return {
    phone: phone || null,
    profileName: item?.profileName ?? item?.instance?.profileName ?? null,
    connectionStatus: item?.connectionStatus ?? item?.instance?.status ?? null,
  };
}

export async function logoutInstance(instanceName) {
  const result = await evolutionRequest(`/instance/logout/${enc(instanceName)}`, { method: 'DELETE' });
  invalidateEvolutionStateCache(instanceName);
  return result;
}

export async function deleteInstance(instanceName) {
  const result = await evolutionRequest(`/instance/delete/${enc(instanceName)}`, { method: 'DELETE' });
  invalidateEvolutionStateCache(instanceName);
  return result;
}

export async function restartInstance(instanceName) {
  let result;
  try {
    result = await evolutionRequest(`/instance/restart/${enc(instanceName)}`, { method: 'POST' });
  } catch (err) {
    // v2 releases differ on the verb (POST vs PUT).
    if (err.evolutionStatus !== 404 && err.evolutionStatus !== 405) throw err;
    result = await evolutionRequest(`/instance/restart/${enc(instanceName)}`, { method: 'PUT' });
  }
  invalidateEvolutionStateCache(instanceName);
  return result;
}

/** Point the instance's webhook at our API (incoming messages + connection updates). */
export async function setInstanceWebhook(instanceName, webhookUrl) {
  const attempt = (events) =>
    evolutionRequest(`/webhook/set/${enc(instanceName)}`, {
      method: 'POST',
      body: { webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events } },
    });
  try {
    return await attempt(WEBHOOK_EVENTS);
  } catch (err) {
    // Older v2 builds reject MESSAGES_EDITED.
    if (err.evolutionStatus === 400) return attempt(WEBHOOK_EVENTS_BASIC);
    throw err;
  }
}

export async function findInstanceWebhook(instanceName) {
  return evolutionRequest(`/webhook/find/${enc(instanceName)}`);
}

/* ------------------------------------------------------------------ messaging */

/**
 * Evolution accepts plain digits (international) or a full JID. Group/LID JIDs are kept as is.
 * @param {string} phoneOrJid
 */
export function toEvolutionNumber(phoneOrJid) {
  const raw = String(phoneOrJid ?? '').trim();
  if (!raw) throw new Error('Phone number is required');
  if (raw.includes('@')) {
    if (/@(s\.whatsapp\.net|c\.us)$/i.test(raw)) {
      return raw.split('@')[0].replace(/\D/g, '');
    }
    return raw;
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) throw new Error('Invalid phone number');
  return digits;
}

/** Prefer a LID jid (no real phone known), otherwise the phone. */
export function pickTarget({ phone, remoteJid }) {
  if (remoteJid && /@lid$/i.test(remoteJid)) return remoteJid;
  return phone ?? remoteJid ?? '';
}

export async function sendText(instanceName, phoneOrJid, message) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) throw new Error('Message content is required');

  const body = await evolutionRequest(`/message/sendText/${enc(instanceName)}`, {
    method: 'POST',
    body: { number: toEvolutionNumber(phoneOrJid), text: text.slice(0, 4096) },
  });
  return { status: 'success', messageId: body?.key?.id ?? null, provider: 'evolution', raw: body };
}

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Image by public URL — delivered as a real WhatsApp image. */
export async function sendImageByUrl(instanceName, phoneOrJid, imageUrl, opts = {}) {
  const fileName = opts.fileName ?? 'image.jpg';
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
  const body = await evolutionRequest(`/message/sendMedia/${enc(instanceName)}`, {
    method: 'POST',
    body: {
      number: toEvolutionNumber(phoneOrJid),
      mediatype: 'image',
      mimetype: MIME_BY_EXT[ext] ?? 'image/jpeg',
      media: imageUrl,
      fileName,
      caption: opts.caption ? opts.caption.slice(0, 1024) : '',
    },
  });
  return { status: 'success', messageId: body?.key?.id ?? null, provider: 'evolution', raw: body };
}

/** Voice note (PTT) from a public URL or base64. */
export async function sendVoiceNote(instanceName, phoneOrJid, { url, base64 }) {
  const audio = url ?? String(base64 ?? '').replace(/^data:[^,]+,/, '');
  if (!audio) throw new Error('Audio is required');
  const body = await evolutionRequest(`/message/sendWhatsAppAudio/${enc(instanceName)}`, {
    method: 'POST',
    body: { number: toEvolutionNumber(phoneOrJid), audio, encoding: true },
  });
  return { status: 'success', messageId: body?.key?.id ?? null, provider: 'evolution', raw: body };
}

/** Download the media of an incoming message as base64 (used for customer voice notes). */
export async function getMediaBase64(instanceName, messageId) {
  const body = await evolutionRequest(`/chat/getBase64FromMediaMessage/${enc(instanceName)}`, {
    method: 'POST',
    body: { message: { key: { id: messageId } }, convertToMp4: false },
  });
  const base64 = String(body?.base64 ?? '').replace(/^data:[^,]+,/, '');
  if (!base64) throw new Error('Evolution API returned no media');
  return { base64, mimeType: String(body?.mimetype ?? '').split(';')[0] || 'audio/ogg' };
}
