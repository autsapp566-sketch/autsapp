import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { getUserAccess } from '../services/agentAccess.js';

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
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function attachUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
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
