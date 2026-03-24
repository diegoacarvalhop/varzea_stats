import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function InactiveAccountGate() {
  const { isAuthenticated, accountActive } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || accountActive) {
    return <Outlet />;
  }

  if (location.pathname === '/alterar-senha' || location.pathname === '/conta-inativa') {
    return <Outlet />;
  }

  return <Navigate to="/conta-inativa" replace />;
}
