import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { setPeladaContext } from '@/lib/peladaContext';
import type { LoginResult, Role } from '@/services/authService';
import { changePassword as changePasswordRequest, login as loginRequest } from '@/services/authService';

const TOKEN_KEY = 'varzea_token';
const USER_KEY = 'varzea_user';

interface AuthState {
  token: string | null;
  email: string | null;
  name: string | null;
  roles: Role[] | null;
  peladaId: number | null;
  peladaName: string | null;
  /** Logomarca da pelada da conta (quando houver pelada). */
  peladaHasLogo: boolean | null;
  mustChangePassword: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, expectedPeladaId?: number | null) => Promise<LoginResult>;
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<LoginResult>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRolesFromStored(u: {
  roles?: Role[];
  role?: Role;
}): Role[] {
  if (Array.isArray(u.roles) && u.roles.length > 0) {
    return u.roles;
  }
  if (u.role) {
    return [u.role];
  }
  return [];
}

function loadStored(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) {
    return {
      token: null,
      email: null,
      name: null,
      roles: null,
      peladaId: null,
      peladaName: null,
      peladaHasLogo: null,
      mustChangePassword: false,
    };
  }
  try {
    const u = JSON.parse(raw) as {
      email: string;
      name: string;
      roles?: Role[];
      role?: Role;
      peladaId?: number | null;
      peladaName?: string | null;
      peladaHasLogo?: boolean | null;
      mustChangePassword?: boolean;
    };
    return {
      token,
      email: u.email,
      name: u.name,
      roles: normalizeRolesFromStored(u),
      peladaId: u.peladaId ?? null,
      peladaName: u.peladaName ?? null,
      peladaHasLogo: u.peladaHasLogo ?? null,
      mustChangePassword: Boolean(u.mustChangePassword),
    };
  } catch {
    return {
      token: null,
      email: null,
      name: null,
      roles: null,
      peladaId: null,
      peladaName: null,
      peladaHasLogo: null,
      mustChangePassword: false,
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(() => loadStored());

  const applyLoginResult = useCallback((res: LoginResult) => {
    if (res.peladaId != null && res.peladaName) {
      setPeladaContext(res.peladaId, res.peladaName, Boolean(res.peladaHasLogo));
    }
    const mustChange = Boolean(res.mustChangePassword);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        email: res.email,
        name: res.name,
        roles: res.roles,
        peladaId: res.peladaId ?? null,
        peladaName: res.peladaName ?? null,
        peladaHasLogo: res.peladaHasLogo ?? null,
        mustChangePassword: mustChange,
      }),
    );
    setState({
      token: res.token,
      email: res.email,
      name: res.name,
      roles: res.roles,
      peladaId: res.peladaId ?? null,
      peladaName: res.peladaName ?? null,
      peladaHasLogo: res.peladaHasLogo ?? null,
      mustChangePassword: mustChange,
    });
  }, []);

  const login = useCallback(async (email: string, password: string, expectedPeladaId?: number | null) => {
    const res: LoginResult = await loginRequest({ email, password });
    const isAdminGlobal = res.roles.includes('ADMIN_GERAL');
    if (expectedPeladaId != null && !isAdminGlobal && res.peladaId !== expectedPeladaId) {
      throw new Error('SELECTED_PELADA_MISMATCH');
    }
    applyLoginResult(res);
    return res;
  }, [applyLoginResult]);

  const changePassword = useCallback(
    async (senhaAtual: string, novaSenha: string) => {
      const res = await changePasswordRequest({ senhaAtual, novaSenha });
      applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      token: null,
      email: null,
      name: null,
      roles: null,
      peladaId: null,
      peladaName: null,
      peladaHasLogo: null,
      mustChangePassword: false,
    });
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      changePassword,
      logout,
      isAuthenticated: Boolean(state.token),
    }),
    [state, login, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
