import net from 'node:net';
import tls from 'node:tls';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import {
  evolutionRequest,
  getEvolutionConfig,
  normalizeEvolutionState,
  pingEvolution,
} from '../evolutionService.js';

/**
 * Infrastructure probes for the super-admin "System Health" screen.
 * Every probe NEVER throws and NEVER returns credentials/tokens (Evolution's fetchInstances response
 * contains per-instance API tokens, so instances are mapped through an explicit allow-list).
 */

const CACHE_MS = 8_000;
/** @type {{ at: number, value: any } | null} */
let evolutionCache = null;

/* ------------------------------------------------------------------ database */

export async function probeDatabase() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: err?.message?.slice(0, 200) ?? 'unreachable' };
  }
}

/* ------------------------------------------------------------------ redis */

/** RESP encoding of a command. */
function resp(...args) {
  return `*${args.length}\r\n${args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join('')}`;
}

/**
 * Minimal Redis PING over a raw socket (no client dependency). Supports redis:// and rediss://,
 * and password / user+password AUTH.
 */
export function probeRedis(url = env.redisUrl, timeoutMs = 3_000) {
  if (!url) return Promise.resolve({ configured: false, ok: null, latencyMs: null, error: null });

  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ configured: true, ok: false, latencyMs: null, error: 'REDIS_URL غير صالح' });
    }

    const secure = parsed.protocol === 'rediss:';
    const port = Number(parsed.port) || 6379;
    const host = parsed.hostname;
    const started = Date.now();
    const password = decodeURIComponent(parsed.password || '');
    const username = decodeURIComponent(parsed.username || '');

    let buffer = '';
    let stage = password ? 'auth' : 'ping';
    let settled = false;

    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ configured: true, ...result });
    };

    const onConnect = () => {
      socket.write(password ? resp('AUTH', ...(username ? [username, password] : [password])) : resp('PING'));
    };

    const socket = secure
      ? tls.connect({ host, port, servername: host }, onConnect)
      : net.connect({ host, port }, onConnect);

    const timer = setTimeout(
      () => done({ ok: false, latencyMs: null, error: 'timeout' }),
      timeoutMs
    );

    socket.on('error', (err) => done({ ok: false, latencyMs: null, error: err.code || err.message }));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (!buffer.includes('\r\n')) return;
      const line = buffer.split('\r\n')[0];
      buffer = '';

      if (line.startsWith('-')) return done({ ok: false, latencyMs: null, error: line.slice(1, 120) });
      if (stage === 'auth') {
        stage = 'ping';
        return socket.write(resp('PING'));
      }
      if (line.toUpperCase().startsWith('+PONG')) {
        return done({ ok: true, latencyMs: Date.now() - started, error: null });
      }
      return done({ ok: false, latencyMs: null, error: 'unexpected reply' });
    });
  });
}

/* ------------------------------------------------------------------ evolution */

function publicInstance(item) {
  const name = item?.name ?? item?.instance?.instanceName ?? item?.instanceName ?? null;
  return {
    name,
    state: normalizeEvolutionState(item?.connectionStatus ?? item?.instance?.status ?? item?.status),
    profileName: item?.profileName ?? null,
    number: item?.number ?? (typeof item?.ownerJid === 'string' ? item.ownerJid.split('@')[0] : null),
    integration: item?.integration ?? null,
    counts: {
      messages: item?._count?.Message ?? null,
      contacts: item?._count?.Contact ?? null,
      chats: item?._count?.Chat ?? null,
    },
    updatedAt: item?.updatedAt ?? null,
  };
}

/**
 * Evolution API snapshot: reachability + version (banner), whether the authenticated instances
 * endpoint works (this also exercises Evolution's own database), and the instance list.
 * Cached for a few seconds so a dashboard polling every 15s plus the users table don't hammer it.
 */
export async function getEvolutionSnapshot({ force = false } = {}) {
  if (!force && evolutionCache && Date.now() - evolutionCache.at < CACHE_MS) return evolutionCache.value;

  const cfg = getEvolutionConfig();
  /** @type {any} */
  let value;

  if (!cfg.baseUrl) {
    value = { configured: false, reachable: false, version: null, latencyMs: null, error: 'EVOLUTION_API_URL غير مضبوط', apiKeyOk: null, instances: [] };
  } else {
    const started = Date.now();
    const banner = await pingEvolution();
    const latencyMs = Date.now() - started;

    if (!banner.reachable) {
      value = { configured: cfg.configured, reachable: false, version: banner.version, latencyMs, error: banner.error, apiKeyOk: null, instances: [] };
    } else if (!cfg.apiKey) {
      value = { configured: false, reachable: true, version: banner.version, latencyMs, error: 'EVOLUTION_API_KEY غير مضبوط', apiKeyOk: null, instances: [] };
    } else {
      try {
        let body;
        try {
          body = await evolutionRequest('/instance/fetchInstances');
        } catch (err) {
          if (err.evolutionStatus !== 404) throw err;
          body = [];
        }
        const list = Array.isArray(body) ? body : Array.isArray(body?.instances) ? body.instances : [];
        value = {
          configured: true,
          reachable: true,
          version: banner.version,
          latencyMs,
          error: null,
          apiKeyOk: true,
          instances: list.map(publicInstance).filter((i) => i.name),
        };
      } catch (err) {
        value = {
          configured: true,
          reachable: true,
          version: banner.version,
          latencyMs,
          error: String(err?.message ?? 'Evolution error').slice(0, 200),
          apiKeyOk: false,
          instances: [],
        };
      }
    }
  }

  evolutionCache = { at: Date.now(), value };
  return value;
}

export function clearEvolutionSnapshotCache() {
  evolutionCache = null;
}

/* ------------------------------------------------------------------ aggregate */

/**
 * @returns {'operational' | 'degraded' | 'down'}
 */
export function overallStatus({ database, evolution, redis }) {
  if (!database.ok) return 'down';
  if (evolution.configured && (!evolution.reachable || evolution.apiKeyOk === false)) return 'degraded';
  if (redis.configured && !redis.ok) return 'degraded';
  return 'operational';
}

export async function getSystemHealth({ force = false } = {}) {
  const [database, redis, evolution] = await Promise.all([
    probeDatabase(),
    probeRedis(),
    getEvolutionSnapshot({ force }),
  ]);

  // Cross-reference Evolution's instances with our own rows to flag orphans on either side.
  let dbInstanceNames = [];
  if (database.ok) {
    const rows = await prisma.whatsAppInstance.findMany({
      where: { provider: { not: 'green' } },
      select: { instanceName: true },
    });
    dbInstanceNames = rows.map((r) => r.instanceName);
  }
  const known = new Set(dbInstanceNames);
  const remote = new Set(evolution.instances.map((i) => i.name));

  const instances = evolution.instances.map((i) => ({ ...i, tracked: known.has(i.name) }));
  const summary = {
    total: instances.length,
    open: instances.filter((i) => i.state === 'open').length,
    /** Open sessions that belong to a tenant (excludes strays that exist only on the Evolution server). */
    openTracked: instances.filter((i) => i.state === 'open' && i.tracked).length,
    connecting: instances.filter((i) => i.state === 'connecting').length,
    closed: instances.filter((i) => i.state === 'close').length,
    untracked: instances.filter((i) => !i.tracked).length,
    missingOnServer: evolution.reachable && evolution.apiKeyOk ? dbInstanceNames.filter((n) => !remote.has(n)).length : null,
  };

  return {
    status: overallStatus({ database, evolution, redis }),
    checkedAt: new Date().toISOString(),
    database,
    redis,
    evolution: {
      configured: evolution.configured,
      reachable: evolution.reachable,
      apiKeyOk: evolution.apiKeyOk,
      version: evolution.version,
      latencyMs: evolution.latencyMs,
      error: evolution.error,
    },
    instances,
    summary,
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      node: process.version,
    },
  };
}
