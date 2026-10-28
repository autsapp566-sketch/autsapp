/**
 * Platform operator (the SaaS owner), as opposed to a tenant's `ADMIN`.
 * Guards settings that are still GLOBAL across tenants (shared OpenAI key / bot prompt, Evolution API
 * diagnostics, webhook log) so one tenant's admin can never read or change them.
 *
 * Configure with PLATFORM_ADMIN_EMAILS=a@x.com,b@y.com (defaults to ADMIN_EMAIL, the seeded owner).
 */
function platformAdminEmails() {
  const raw = process.env.PLATFORM_ADMIN_EMAILS?.trim() || process.env.ADMIN_EMAIL?.trim() || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function requirePlatformAdmin(req, res, next) {
  // An impersonated session never carries platform powers.
  if (req.impersonatorId) {
    return res.status(403).json({ error: 'Platform administrator access required' });
  }
  if (req.user?.platformRole === 'SUPER_ADMIN') return next();
  const email = String(req.user?.email ?? '').toLowerCase();
  if (req.user?.role === 'ADMIN' && email && platformAdminEmails().has(email)) {
    return next();
  }
  return res.status(403).json({ error: 'Platform administrator access required' });
}
