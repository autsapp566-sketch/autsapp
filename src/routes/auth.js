import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ACCOUNT_BANNED_MESSAGE, authenticate, attachUser, isAccountBlocked } from '../middleware/auth.js';
import { rateLimitByEmail } from '../middleware/rateLimit.js';
import { prisma } from '../lib/prisma.js';
import { getUserAccess } from '../services/agentAccess.js';
import { consumeAuthToken, issueAuthToken } from '../services/authTokens.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/mailer.js';
import { provisionOrganization } from '../services/billing/subscriptionService.js';

const router = express.Router();

const HOUR = 60 * 60 * 1000;
const loginLimit = rateLimitByEmail({ name: 'login', windowMs: 15 * 60 * 1000, max: 20 });
const registerLimit = rateLimitByEmail({ name: 'register', windowMs: HOUR, max: 10 });
const mailLimit = rateLimitByEmail({ name: 'mail', windowMs: HOUR, max: 5 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt only hashes the first 72 bytes; refuse longer input instead of silently truncating it.
const PASSWORD_MAX_BYTES = 72;
// Compared against when the user does not exist, so response time does not reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

function publicUser(user) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: user.role,
    platformRole: user.platformRole,
    createdAt: user.createdAt,
  };
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateEmail(email) {
  if (!email) return 'البريد الإلكتروني مطلوب';
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'صيغة البريد الإلكتروني غير صحيحة';
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || !password) return 'كلمة المرور مطلوبة';
  if (password.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (Buffer.byteLength(password) > PASSWORD_MAX_BYTES) return 'كلمة المرور طويلة جدًا';
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/\d/.test(password)) {
    return 'كلمة المرور يجب أن تحتوي على حرف ورقم';
  }
  return null;
}

function badRequest(res, error, code = 'VALIDATION') {
  return res.status(400).json({ error, code });
}

/** Mail delivery problems must not turn into 500s (and must not reveal whether an account exists). */
async function safeSend(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`[auth] ${label} e-mail failed:`, err.message);
  }
}

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { suspendedAt: true } } },
    });
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    if (isAccountBlocked(user)) {
      return res.status(403).json({ error: ACCOUNT_BANNED_MESSAGE, code: 'ACCOUNT_BANNED' });
    }

    // Only revealed after the password was proven, so it cannot be used to probe for accounts.
    if (!user.emailVerifiedAt) {
      return res.status(403).json({
        error: 'يرجى تأكيد بريدك الإلكتروني أولًا. تحقق من صندوق الوارد.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const access = await getUserAccess(user);
    if (!access.active) {
      return res.status(403).json({ error: 'تم تعطيل حسابك. تواصل مع المدير.' });
    }

    // `org` is informational: every request re-reads the user (and thus the organization) from the DB.
    const token = jwt.sign({ sub: user.id, org: user.organizationId, role: user.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    });

    res.json({
      token,
      user: { ...publicUser(user), permissions: access.permissions, instanceIds: access.instanceIds },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Self-service signup: creates a new organization, its first ADMIN (unverified) and a trial
 * subscription on the Starter limits. The response is identical whether or not the e-mail is
 * already registered, so the endpoint cannot be used to enumerate accounts.
 */
router.post('/register', registerLimit, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const organizationName = typeof req.body.organizationName === 'string' ? req.body.organizationName.trim() : '';
    const password = req.body.password;

    if (organizationName.length < 2 || organizationName.length > 80) {
      return badRequest(res, 'اسم المشروع يجب أن يكون بين 2 و80 حرفًا');
    }
    const emailError = validateEmail(email);
    if (emailError) return badRequest(res, emailError);
    const passwordError = validatePassword(password);
    if (passwordError) return badRequest(res, passwordError);

    const accepted = { ok: true, message: 'تحقق من بريدك الإلكتروني لتأكيد الحساب.' };

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
    if (existing) {
      if (!existing.emailVerifiedAt) {
        const token = await issueAuthToken(existing.id, 'EMAIL_VERIFICATION');
        await safeSend('verification', () => sendVerificationEmail(email, token));
      }
      return res.status(202).json(accepted);
    }

    const trialing = env.trialDays > 0;
    let admin;
    try {
      ({ admin } = await provisionOrganization({
        name: organizationName,
        planTier: 'STARTER',
        // TRIAL_DAYS=0 => no free access: the org starts without an active subscription until billing is attached.
        status: trialing ? 'ACTIVE' : 'PAST_DUE',
        provider: 'MANUAL',
        currentPeriodEnd: new Date(Date.now() + (trialing ? env.trialDays : 0) * 24 * HOUR),
        admin: { email, passwordHash: await bcrypt.hash(password, 12) },
      }));
    } catch (err) {
      // Two concurrent signups with the same e-mail: the loser looks exactly like "already registered".
      if (err?.code === 'P2002' && (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
        return res.status(202).json(accepted);
      }
      throw err;
    }

    const token = await issueAuthToken(admin.id, 'EMAIL_VERIFICATION');
    await safeSend('verification', () => sendVerificationEmail(email, token));
    return res.status(201).json(accepted);
  } catch (err) {
    next(err);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const userId = await consumeAuthToken(req.body.token, 'EMAIL_VERIFICATION');
    if (!userId) {
      return badRequest(res, 'رابط التأكيد غير صالح أو منتهي الصلاحية', 'INVALID_TOKEN');
    }
    await prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-verification', mailLimit, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (validateEmail(email)) return badRequest(res, 'صيغة البريد الإلكتروني غير صحيحة');

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
    if (user && !user.emailVerifiedAt) {
      const token = await issueAuthToken(user.id, 'EMAIL_VERIFICATION');
      await safeSend('verification', () => sendVerificationEmail(email, token));
    }
    res.json({ ok: true, message: 'إن كان البريد مسجلًا ولم يُؤكد بعد فقد أرسلنا رابطًا جديدًا.' });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', mailLimit, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (validateEmail(email)) return badRequest(res, 'صيغة البريد الإلكتروني غير صحيحة');

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const token = await issueAuthToken(user.id, 'PASSWORD_RESET');
      await safeSend('password reset', () => sendPasswordResetEmail(email, token));
    }
    res.json({ ok: true, message: 'إن كان البريد مسجلًا فقد أرسلنا رابط إعادة التعيين.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    // Validate first: a typo in the new password must not burn the single-use link.
    const passwordError = validatePassword(req.body.password);
    if (passwordError) return badRequest(res, passwordError);

    const userId = await consumeAuthToken(req.body.token, 'PASSWORD_RESET');
    if (!userId) {
      return badRequest(res, 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية', 'INVALID_TOKEN');
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        // Possessing the e-mailed link proves ownership of the address, so it also verifies it.
        data: { password: passwordHash, passwordChangedAt: now },
      }),
      prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } }),
      prisma.authToken.updateMany({
        where: { userId, type: 'PASSWORD_RESET', usedAt: null },
        data: { usedAt: now },
      }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, attachUser, (req, res) => {
  res.json({
    user: req.user,
    // Lets the dashboard show a "you are impersonating" banner.
    impersonation: req.impersonatorId ? { byUserId: req.impersonatorId } : null,
  });
});

export default router;
