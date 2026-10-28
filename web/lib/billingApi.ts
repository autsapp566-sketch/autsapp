import 'server-only';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export type BillingResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; code?: string };

/** Server-to-server call to the Express billing API with the given user's API token. */
export async function billingFetch<T>(
  path: string,
  token: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<BillingResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data.error === 'string' ? data.error : `خطأ ${res.status}`,
        code: typeof data.code === 'string' ? data.code : undefined,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch {
    return { ok: false, status: 0, error: 'تعذر الاتصال بالخادم.' };
  }
}

/* ---- shapes returned by GET /api/billing/subscription and /plans ---- */

export type SubscriptionSummary = {
  active: boolean;
  reason: string | null;
  subscription: {
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
    provider: 'STRIPE' | 'PADDLE' | 'MANUAL';
    currentPeriodStart: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    portalAvailable: boolean;
  } | null;
  plan: { id: string; tier: string; name: string; priceMonthlyCents: number; currency: string } | null;
  usage: {
    whatsappInstances: { used: number; limit: number | null };
    aiMessages: { used: number; limit: number | null; periodStart: string; periodEnd: string };
  } | null;
};

export type PublicPlan = {
  id: string;
  tier: string;
  name: string;
  checkoutAvailable: boolean;
  priceMonthlyCents: number;
  currency: string;
  maxWhatsAppInstances: number | null;
  monthlyAiMessages: number | null;
};

export type MeResponse = {
  user: { id: string; email: string; role: string };
  impersonation: { byUserId: string } | null;
};
