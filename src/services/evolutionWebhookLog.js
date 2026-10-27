import { getAppSetting, setAppSetting } from './appSettings.js';

const KEY = 'evolution-webhook-log';
const MAX = 25;

function maskJid(jid) {
  const s = String(jid ?? '');
  if (!s) return null;
  const [id, domain] = s.split('@');
  return `…${id.slice(-4)}@${domain ?? ''}`;
}

/**
 * Remember the last webhook calls from Evolution so the admin can see whether messages arrive at all.
 * Never throws and never stores message text.
 * @param {{ event?: string, body?: any, result: string, ok?: boolean }} hit
 */
export async function recordEvolutionHit({ event, body, result, ok = true }) {
  try {
    const key = body?.data?.key;
    const entry = {
      at: new Date().toISOString(),
      event: event ?? null,
      instance: body?.instance ?? null,
      fromMe: typeof key?.fromMe === 'boolean' ? key.fromMe : null,
      jid: maskJid(key?.remoteJid),
      result,
      ok,
    };
    const current = (await getAppSetting(KEY)) ?? [];
    const list = Array.isArray(current) ? current : [];
    await setAppSetting(KEY, [entry, ...list].slice(0, MAX));
  } catch (err) {
    console.error('[evolution-webhook-log] could not save:', err.message);
  }
}

export async function listEvolutionHits() {
  const list = await getAppSetting(KEY);
  return Array.isArray(list) ? list : [];
}
