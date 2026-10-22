/** Allows ADMIN always; agents need at least one of the given permissions (set by the admin). */
export function requirePermission(...keys) {
  return (req, res, next) => {
    if (req.user?.role === 'ADMIN') {
      return next();
    }
    const granted = req.user?.permissions ?? {};
    if (keys.some((k) => granted[k])) {
      return next();
    }
    return res.status(403).json({ error: 'ليست لديك صلاحية لهذا الإجراء. تواصل مع المدير.' });
  };
}
