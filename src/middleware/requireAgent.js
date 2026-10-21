export function requireAgent(req, res, next) {
  const role = req.user?.role ?? req.userRole;
  if (role === 'ADMIN' || role === 'CONFIRMATION_AGENT') {
    return next();
  }
  return res.status(403).json({ error: 'Agent access required' });
}
