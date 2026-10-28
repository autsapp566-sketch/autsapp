/** Shapes returned by the Express /api/admin routes. */

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
export type SystemStatus = 'operational' | 'degraded' | 'down';

export type Overview = {
  generatedAt: string;
  users: { total: number; active: number; banned: number; newLast7Days: number };
  organizations: { suspended: number };
  mrr: {
    cents: number;
    currency: string;
    payingOrganizations: number;
    byPlan: { tier: PlanTier; name: string; subscribers: number; mrrCents: number }[];
  };
  whatsapp: { registered: number; connected: number | null; connecting: number };
  system: { status: SystemStatus };
};

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  platformRole: 'USER' | 'SUPER_ADMIN';
  createdAt: string;
  emailVerified: boolean;
  banned: { at: string; reason: string | null } | null;
  organization: { id: string; name: string; suspended: boolean };
  subscription: {
    planTier: PlanTier;
    planName: string;
    status: SubscriptionStatus;
    provider: 'STRIPE' | 'PADDLE' | 'MANUAL';
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    effective: { active: boolean; reason: string | null };
  } | null;
  instances: { total: number; connected: number | null };
};

export type UsersPage = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  evolutionAvailable: boolean;
};

export type HealthInstance = {
  name: string;
  state: string;
  profileName: string | null;
  number: string | null;
  integration: string | null;
  counts: { messages: number | null; contacts: number | null; chats: number | null };
  updatedAt: string | null;
  tracked: boolean;
};

export type SystemHealth = {
  status: SystemStatus;
  checkedAt: string;
  database: { ok: boolean; latencyMs: number | null; error: string | null };
  redis: { configured: boolean; ok: boolean | null; latencyMs: number | null; error: string | null };
  evolution: {
    configured: boolean;
    reachable: boolean;
    apiKeyOk: boolean | null;
    version: string | null;
    latencyMs: number | null;
    error: string | null;
  };
  instances: HealthInstance[];
  summary: {
    total: number;
    open: number;
    openTracked: number;
    connecting: number;
    closed: number;
    untracked: number;
    missingOnServer: number | null;
  };
  process: { uptimeSeconds: number; memoryMb: number; node: string };
};

export type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ActionResult = { ok: boolean; error?: string; warnings?: string[] };
