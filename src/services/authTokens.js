import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';

export const TOKEN_TTL_MS = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a fresh token and invalidates every older unused token of the same type for that user.
 * The raw token is returned once (to be e-mailed); only its hash is persisted.
 */
export async function issueAuthToken(userId, type) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
      },
    }),
  ]);
  return token;
}

/**
 * Atomically burns a token: the UPDATE only matches an unused, unexpired row of the right type,
 * so two concurrent requests with the same link cannot both succeed.
 * @returns {Promise<string | null>} the userId, or null when the token is invalid/used/expired
 */
export async function consumeAuthToken(token, type) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;

  const tokenHash = hashToken(token);
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count !== 1) return null;

  const row = await prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return row?.userId ?? null;
}
