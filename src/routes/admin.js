import { Router } from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import { createHttpError } from '../lib/httpErrors.js';
import { getOverview } from '../services/admin/adminStats.js';
import { listAudit } from '../services/admin/auditLog.js';
import {
  banUser,
  changeSubscription,
  listUsers,
  startImpersonation,
  unbanUser,
} from '../services/admin/adminUsers.js';
import { getSystemHealth } from '../services/admin/systemHealth.js';

/**
 * Super-admin API (mounted at /api/admin).
 * EVERY route sits behind authenticate -> attachUser (role re-read from the database) -> requireSuperAdmin.
 */
export const adminRouter = Router();

adminRouter.use(authenticate, attachUser, requireSuperAdmin);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

function optionalString(value, field, max = 300) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw createHttpError(`${field} غير صالح`, 400);
  return value.slice(0, max);
}

function optionalBool(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw createHttpError(`${field} يجب أن يكون true أو false`, 400);
  return value;
}

/** Cheap "am I allowed in?" probe for the Next.js layout guard. */
adminRouter.get('/session', (req, res) => {
  res.json({
    user: { id: req.user.id, email: req.user.email, platformRole: req.user.platformRole },
  });
});

adminRouter.get('/overview', asyncRoute(async (_req, res) => {
  res.json(await getOverview());
}));

adminRouter.get('/users', asyncRoute(async (req, res) => {
  const { search, status, page, pageSize } = req.query;
  res.json(
    await listUsers({
      search: typeof search === 'string' ? search : '',
      status: typeof status === 'string' ? status : '',
      page,
      pageSize,
    })
  );
}));

adminRouter.post('/users/:id/ban', asyncRoute(async (req, res) => {
  const reason = optionalString(req.body?.reason, 'السبب');
  const suspendOrganization = optionalBool(req.body?.suspendOrganization, 'suspendOrganization');
  res.json(await banUser(req.user, req.params.id, { reason, suspendOrganization }));
}));

adminRouter.post('/users/:id/unban', asyncRoute(async (req, res) => {
  const restoreOrganization = optionalBool(req.body?.restoreOrganization, 'restoreOrganization');
  res.json(await unbanUser(req.user, req.params.id, { restoreOrganization }));
}));

adminRouter.post('/users/:id/subscription', asyncRoute(async (req, res) => {
  const { planTier, status, periodDays } = req.body ?? {};
  res.json(await changeSubscription(req.user, req.params.id, { planTier, status, periodDays }));
}));

adminRouter.post('/users/:id/impersonate', asyncRoute(async (req, res) => {
  res.json(await startImpersonation(req.user, req.params.id));
}));

adminRouter.get('/health', asyncRoute(async (req, res) => {
  res.json(await getSystemHealth({ force: req.query.refresh === '1' }));
}));

adminRouter.get('/audit', asyncRoute(async (req, res) => {
  const targetUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  res.json({ entries: await listAudit({ limit: req.query.limit, targetUserId }) });
}));
