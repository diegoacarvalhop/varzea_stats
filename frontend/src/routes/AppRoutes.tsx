import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { InactiveAccountGate } from '@/components/InactiveAccountGate';
import { PlayerMembershipGate } from '@/components/PlayerMembershipGate';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RequireAuth } from '@/components/RequireAuth';
import { RequirePasswordChangeGate } from '@/components/RequirePasswordChangeGate';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FinancePage } from '@/pages/FinancePage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { InactiveAccountPage } from '@/pages/InactiveAccountPage';
import { LoginPage } from '@/pages/LoginPage';
import { MembershipPage } from '@/pages/MembershipPage';
import { PeladaSettingsPage } from '@/pages/PeladaSettingsPage';
import { PublicHomePage } from '@/pages/PublicHomePage';
import { RegisterPage } from '@/pages/RegisterPage';
import { RedefinirSenhaPage } from '@/pages/RedefinirSenhaPage';
import { MatchDetailPage } from '@/pages/MatchDetailPage';
import { MatchesPage } from '@/pages/MatchesPage';
import { MediaPage } from '@/pages/MediaPage';
import { RankingPage } from '@/pages/RankingPage';
import { StatsPage } from '@/pages/StatsPage';
import { SelectPeladaPage } from '@/pages/SelectPeladaPage';
import { UsersAdminPage } from '@/pages/UsersAdminPage';
import {
  FINANCE_MODULE_ROLES,
  MEDIA_ROLES,
  PELADA_SETTINGS_ROLES,
  USER_ADMIN_ROLES,
} from '@/lib/roles';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
      <Route element={<RequirePasswordChangeGate />}>
        <Route path="/alterar-senha" element={<ChangePasswordPage />} />
        <Route element={<InactiveAccountGate />}>
          <Route path="/conta-inativa" element={<InactiveAccountPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<PlayerMembershipGate />}>
              <Route element={<Layout />}>
                <Route path="/pelada" element={<SelectPeladaPage />} />
                <Route path="/painel" element={<DashboardPage />} />
                <Route path="/minhas-peladas" element={<MembershipPage />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/matches/:matchId" element={<MatchDetailPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/ranking" element={<RankingPage />} />
                <Route
                  path="/media"
                  element={
                    <ProtectedRoute roles={MEDIA_ROLES}>
                      <MediaPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute roles={USER_ADMIN_ROLES}>
                      <UsersAdminPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pelada/config"
                  element={
                    <ProtectedRoute roles={PELADA_SETTINGS_ROLES}>
                      <PeladaSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/financeiro"
                  element={
                    <ProtectedRoute roles={FINANCE_MODULE_ROLES}>
                      <FinancePage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
