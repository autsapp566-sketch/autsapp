/** Admin can do everything; agents only what the admin enabled for them. */
export function can(user, ...keys) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return keys.some((k) => user.permissions?.[k]);
}

/** Dashboard pages in order: path, who may see it. `permissions` empty + `adminOnly` => admin only. */
export const PAGE_ACCESS = [
  { to: '/dashboard', permissions: ['analytics'] },
  { to: '/dashboard/qualified', permissions: ['leads'] },
  { to: '/dashboard/chats', permissions: ['chats', 'leads'] },
  { to: '/dashboard/knowledge', permissions: ['knowledge', 'knowledgeEdit'] },
  { to: '/dashboard/playground', permissions: ['playground'] },
  { to: '/dashboard/whatsapp', adminOnly: true },
  { to: '/dashboard/team', adminOnly: true },
];

export function canOpenPage(user, page) {
  if (page.adminOnly) return user?.role === 'ADMIN';
  return can(user, ...(page.permissions ?? []));
}

/** First page the user may open (settings is always available). */
export function firstAllowedPath(user) {
  const page = PAGE_ACCESS.find((p) => canOpenPage(user, p));
  return page?.to ?? '/dashboard/settings';
}
