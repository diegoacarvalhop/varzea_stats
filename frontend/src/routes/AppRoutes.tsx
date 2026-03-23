import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RequirePasswordChangeGate } from '@/components/RequirePasswordChangeGate';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { RedefinirSenhaPage } from '@/pages/RedefinirSenhaPage';
import { MatchDetailPage } from '@/pages/MatchDetailPage';
import { MatchesPage } from '@/pages/MatchesPage';
import { MediaPage } from '@/pages/MediaPage';
import { RankingPage } from '@/pages/RankingPage';
import { StatsPage } from '@/pages/StatsPage';
import { SelectPeladaPage } from '@/pages/SelectPeladaPage';
import { UsersAdminPage } from '@/pages/UsersAdminPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
      <Route element={<RequirePasswordChangeGate />}>
        <Route path="/alterar-senha" element={<ChangePasswordPage />} />
        <Route element={<Layout />}>
        <Route path="pelada" element={<SelectPeladaPage />} />
        <Route index element={<DashboardPage />} />
        <Route path="matches" element={<MatchesPage />} />
        <Route path="matches/:matchId" element={<MatchDetailPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route
          path="media"
          element={
            <ProtectedRoute roles={['ADMIN_GERAL', 'ADMIN', 'MEDIA']}>
              <MediaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={['ADMIN_GERAL', 'ADMIN']}>
              <UsersAdminPage />
            </ProtectedRoute>
          }
        />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
