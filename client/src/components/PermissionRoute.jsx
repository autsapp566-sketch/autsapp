import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { canOpenPage, firstAllowedPath, PAGE_ACCESS } from '../lib/access.js';

/** Renders `children` only if the signed-in user may open `to`; otherwise sends them to their first allowed page. */
export default function PermissionRoute({ to, children }) {
  const { user } = useAuth();
  const page = PAGE_ACCESS.find((p) => p.to === to);
  if (page && !canOpenPage(user, page)) {
    const fallback = firstAllowedPath(user);
    if (fallback !== to) {
      return <Navigate to={fallback} replace />;
    }
  }
  return children;
}
