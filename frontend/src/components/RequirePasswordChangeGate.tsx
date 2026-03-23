import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/** Redireciona para /alterar-senha enquanto a conta exigir troca de senha (primeiro acesso). */
export function RequirePasswordChangeGate() {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const location = useLocation();
  if (isAuthenticated && mustChangePassword && location.pathname !== '/alterar-senha') {
    return <Navigate to="/alterar-senha" replace />;
  }
  return <Outlet />;
}
