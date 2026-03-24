import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function PlayerMembershipGate() {
  const { roles, membershipPeladaIds } = useAuth();
  const location = useLocation();

  const playerOnly = roles?.length === 1 && roles[0] === 'PLAYER';
  if (!playerOnly) {
    return <Outlet />;
  }

  if (location.pathname === '/minhas-peladas') {
    return <Outlet />;
  }

  if (!membershipPeladaIds?.length) {
    return <Navigate to="/minhas-peladas" replace />;
  }

  return <Outlet />;
}
