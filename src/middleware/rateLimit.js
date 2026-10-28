const buckets = new Map();

function sweep(now) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

/**
 * Fixed-window limiter keyed by the target e-mail address (brute-force / mail-flood protection).
 * Keyed by e-mail rather than IP because the Next.js server is the only caller, so every request
 * shares one source IP.
 *
 * In-memory: on serverless / multi-instance deployments the limit applies per instance. Move to
 * Redis/Upstash before relying on it as the only brute-force defence.
 */
export function rateLimitByEmail({ name, windowMs, max }) {
  return (req, res, next) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return next();

    const now = Date.now();
    sweep(now);
    const key = `${name}:${email}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({
        error: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.',
        code: 'RATE_LIMITED',
      });
    }
    return next();
  };
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
