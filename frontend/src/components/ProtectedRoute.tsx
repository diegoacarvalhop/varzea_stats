import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { hasAnyRole } from '@/lib/roles';
import type { Role } from '@/services/authService';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, roles: userRoles } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !hasAnyRole(userRoles, roles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
