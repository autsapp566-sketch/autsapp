import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { getUserAccess } from '../services/agentAccess.js';

export const ACCOUNT_BANNED_MESSAGE = 'تم تعليق هذا الحساب من قِبل إدارة المنصة. تواصل مع الدعم.';

/** Banned user, or member of a suspended organization. */
export function isAccountBlocked(user) {
  return Boolean(user?.bannedAt || user?.organization?.suspendedAt);
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.tokenIssuedAt = payload.iat;
    // Present only on tokens minted by POST /api/admin/users/:id/impersonate.
    req.impersonatorId = typeof payload.imp === 'string' ? payload.imp : null;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function attachUser(req, res, next) {
  try {
    const row = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        platformRole: true,
        createdAt: true,
        passwordChangedAt: true,
        bannedAt: true,
        organization: { select: { suspendedAt: true } },
      },
    });

    if (!row) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { passwordChangedAt, bannedAt, organization, ...user } = row;

    // A password reset revokes every session issued before it.
    if (passwordChangedAt && Number(req.tokenIssuedAt) < Math.floor(passwordChangedAt.getTime() / 1000)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    if (isAccountBlocked({ bannedAt, organization })) {
      return res.status(403).json({ error: ACCOUNT_BANNED_MESSAGE, code: 'ACCOUNT_BANNED' });
    }

    const access = await getUserAccess(user);
    if (!access.active) {
      return res.status(403).json({ error: 'تم تعطيل حسابك. تواصل مع المدير.' });
    }

    req.user = { ...user, permissions: access.permissions, instanceIds: access.instanceIds };
    next();
  } catch (err) {
    next(err);
  }
}
