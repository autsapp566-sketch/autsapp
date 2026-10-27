import bcrypt from 'bcryptjs';
import express from 'express';
import { authenticate, attachUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { prisma } from '../lib/prisma.js';
import { PERMISSIONS, ROLE_PRESETS, normalizePermissions } from '../lib/permissions.js';
import { loadAccessMap, normalizeInstanceIds, removeUserAccess, setUserAccess } from '../services/agentAccess.js';

const router = express.Router();

router.use(authenticate, attachUser, requireAdmin);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

function serializeMember(user, access, leadsCount) {
  const isAdmin = user.role === 'ADMIN';
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    active: isAdmin ? true : access?.active !== false,
    permissions: normalizePermissions(isAdmin ? PERMISSIONS.map((p) => p.key) : access?.permissions),
    // null = every WhatsApp number; array = only these numbers (WhatsAppInstance ids)
    instanceIds: isAdmin ? null : normalizeInstanceIds(access?.instanceIds),
    assignedLeads: leadsCount ?? 0,
  };
}

async function loadMember(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, createdAt: true, _count: { select: { assignedLeads: true } } },
  });
  if (!user) {
    throw httpError(404, 'المستخدم غير موجود');
  }
  return user;
}

router.get('/', async (_req, res, next) => {
  try {
    const [users, map, instances] = await Promise.all([
      prisma.user.findMany({
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, email: true, role: true, createdAt: true, _count: { select: { assignedLeads: true } } },
      }),
      loadAccessMap(),
      prisma.whatsAppInstance.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    ]);
    res.json({
      members: users.map((u) => serializeMember(u, map[u.id], u._count.assignedLeads)),
      catalog: PERMISSIONS,
      presets: ROLE_PRESETS,
      // WhatsApp numbers the admin can assign to an agent
      instances: instances.map((i) => ({
        id: i.id,
        label: i.label || i.instanceName,
        phone: i.phone,
        isDefault: i.isDefault,
        legacy: i.provider === 'green',
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!EMAIL_RE.test(email)) {
      throw httpError(400, 'أدخل بريداً إلكترونياً صحيحاً');
    }
    if (password.length < 8) {
      throw httpError(400, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
      throw httpError(409, 'هذا البريد مستعمل من قبل');
    }

    const user = await prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 12), role: 'CONFIRMATION_AGENT' },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    const access = await setUserAccess(user.id, {
      active: true,
      permissions: req.body?.permissions,
      instanceIds: req.body?.instanceIds,
    });
    res.status(201).json({ member: serializeMember(user, access, 0) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const user = await loadMember(req.params.id);
    if (user.role === 'ADMIN') {
      throw httpError(400, 'لا يمكن تعديل صلاحيات المدير');
    }

    const body = req.body ?? {};
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        throw httpError(400, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(body.password, 12) },
      });
    }

    const access = await setUserAccess(user.id, {
      active: body.active === undefined ? undefined : Boolean(body.active),
      permissions: body.permissions,
      // undefined = keep, null = all numbers, [ids] = restrict
      instanceIds: body.instanceIds,
    });
    res.json({ member: serializeMember(user, access, user._count.assignedLeads) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const user = await loadMember(req.params.id);
    if (user.role === 'ADMIN' || user.id === req.user.id) {
      throw httpError(400, 'لا يمكن حذف حساب المدير');
    }
    await prisma.user.delete({ where: { id: user.id } });
    await removeUserAccess(user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
