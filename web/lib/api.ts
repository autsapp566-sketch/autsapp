import 'server-only';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export type ApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T & { error?: string; code?: string };
};

/** Server-to-server call to the Express API. Never import from a client component. */
export async function apiPost<T = Record<string, unknown>>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as ApiResult<T>['data'];
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: 'تعذر الاتصال بالخادم. حاول مرة أخرى بعد قليل.', code: 'UNREACHABLE' } as ApiResult<T>['data'],
    };
  }
}
