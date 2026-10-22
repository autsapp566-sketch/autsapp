import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { authenticate, attachUser } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { getUserAccess } from '../services/agentAccess.js';

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const access = await getUserAccess(user);
    if (!access.active) {
      return res.status(403).json({ error: 'تم تعطيل حسابك. تواصل مع المدير.' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    });

    res.json({
      token,
      user: { ...publicUser(user), permissions: access.permissions },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, attachUser, (req, res) => {
  res.json({ user: req.user });
});

export default router;
