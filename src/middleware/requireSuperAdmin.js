/**
 * Gate for every /api/admin route. Must run after `authenticate` + `attachUser`, so `req.user` was
 * loaded from the DATABASE (the role is never read from the JWT: demoting an admin takes effect on
 * their very next request).
 *
 * Impersonation tokens are refused even if the target were a super admin, so an impersonated session
 * can never reach the panel.
 */
export function requireSuperAdmin(req, res, next) {
  if (req.user?.platformRole === 'SUPER_ADMIN' && !req.impersonatorId) {
    return next();
  }
  // 404 rather than 403: don't advertise that the panel exists to ordinary tenants.
  return res.status(404).json({ error: 'Not found' });
}
