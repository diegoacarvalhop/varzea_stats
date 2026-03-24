import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearPeladaContext,
  getPeladaHasLogo,
  getPeladaId,
  getPeladaName,
  setPeladaContext,
} from '@/lib/peladaContext';
import { isAdminGeral } from '@/lib/roles';
import type { LoginResult, MembershipUpdatePayload, Role } from '@/services/authService';
import {
  changePassword as changePasswordRequest,
  fetchProfile,
  login as loginRequest,
  updateMemberships as updateMembershipsRequest,
} from '@/services/authService';
import { api } from '@/services/api';

const TOKEN_KEY = 'varzea_token';
const USER_KEY = 'varzea_user';

interface AuthState {
  token: string | null;
  email: string | null;
  name: string | null;
  roles: Role[] | null;
  peladaId: number | null;
  peladaName: string | null;
  peladaHasLogo: boolean | null;
  mustChangePassword: boolean;
  membershipPeladaIds: number[];
  monthlyDelinquentPeladaIds: number[];
  accountActive: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<LoginResult>;
  refreshProfile: () => Promise<LoginResult>;
  updateMemberships: (payload: MembershipUpdatePayload) => Promise<LoginResult>;
  switchPelada: (id: number, name: string, hasLogo: boolean) => void;
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
      membershipPeladaIds: [],
      monthlyDelinquentPeladaIds: [],
      accountActive: true,
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
      membershipPeladaIds?: number[];
      monthlyDelinquentPeladaIds?: number[];
      accountActive?: boolean;
    };
    const roles = normalizeRolesFromStored(u);
    let peladaId = u.peladaId ?? null;
    let peladaName = u.peladaName ?? null;
    let peladaHasLogo = u.peladaHasLogo ?? null;
    if (isAdminGeral(roles) && peladaId == null) {
      const ctxId = getPeladaId();
      const ctxName = getPeladaName();
      if (ctxId != null && ctxName != null && ctxId.length > 0) {
        const n = Number(ctxId);
        if (Number.isFinite(n)) {
          peladaId = n;
          peladaName = ctxName;
          peladaHasLogo = getPeladaHasLogo();
          localStorage.setItem(
            USER_KEY,
            JSON.stringify({
              ...u,
              peladaId: n,
              peladaName: ctxName,
              peladaHasLogo,
            }),
          );
        }
      }
    }
    if (peladaId != null && peladaName) {
      setPeladaContext(peladaId, peladaName, Boolean(peladaHasLogo));
    }
    return {
      token,
      email: u.email,
      name: u.name,
      roles,
      peladaId,
      peladaName,
      peladaHasLogo,
      mustChangePassword: Boolean(u.mustChangePassword),
      membershipPeladaIds: Array.isArray(u.membershipPeladaIds) ? u.membershipPeladaIds : [],
      monthlyDelinquentPeladaIds: Array.isArray(u.monthlyDelinquentPeladaIds)
        ? u.monthlyDelinquentPeladaIds
        : [],
      accountActive: u.accountActive !== false,
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
      membershipPeladaIds: [],
      monthlyDelinquentPeladaIds: [],
      accountActive: true,
    };
  }
}

function buildUserJson(res: LoginResult, mustChange: boolean) {
  return {
    email: res.email,
    name: res.name,
    roles: res.roles,
    peladaId: res.peladaId ?? null,
    peladaName: res.peladaName ?? null,
    peladaHasLogo: res.peladaHasLogo ?? null,
    mustChangePassword: mustChange,
    membershipPeladaIds: res.membershipPeladaIds ?? [],
    monthlyDelinquentPeladaIds: res.monthlyDelinquentPeladaIds ?? [],
    accountActive: res.accountActive !== false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(() => loadStored());

  const syncPeladaAfterLogin = useCallback(async (res: LoginResult) => {
    if (res.roles.includes('ADMIN_GERAL')) {
      if (res.peladaId == null) {
        clearPeladaContext();
      } else if (res.peladaName) {
        setPeladaContext(res.peladaId, res.peladaName, Boolean(res.peladaHasLogo));
      }
      return;
    }
    if (res.peladaId != null && res.peladaName) {
      setPeladaContext(res.peladaId, res.peladaName, Boolean(res.peladaHasLogo));
      return;
    }
    const mids = res.membershipPeladaIds ?? [];
    if (mids.length > 0) {
      try {
        const { data } = await api.get<Array<{ id: number; name: string; hasLogo: boolean }>>('/peladas');
        const firstId = mids[0];
        const p = data.find((x) => x.id === firstId);
        if (p) {
          setPeladaContext(p.id, p.name, Boolean(p.hasLogo));
          const raw = localStorage.getItem(USER_KEY);
          if (raw) {
            const u = JSON.parse(raw) as Record<string, unknown>;
            u.peladaId = p.id;
            u.peladaName = p.name;
            u.peladaHasLogo = p.hasLogo;
            localStorage.setItem(USER_KEY, JSON.stringify(u));
          }
          setState((prev) => ({
            ...prev,
            peladaId: p.id,
            peladaName: p.name,
            peladaHasLogo: p.hasLogo,
          }));
        }
      } catch {
        clearPeladaContext();
      }
      return;
    }
    clearPeladaContext();
  }, []);

  const applyLoginResult = useCallback(
    async (res: LoginResult) => {
      const mustChange = Boolean(res.mustChangePassword);
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(buildUserJson(res, mustChange)));
      setState({
        token: res.token,
        email: res.email,
        name: res.name,
        roles: res.roles,
        peladaId: res.peladaId ?? null,
        peladaName: res.peladaName ?? null,
        peladaHasLogo: res.peladaHasLogo ?? null,
        mustChangePassword: mustChange,
        membershipPeladaIds: res.membershipPeladaIds ?? [],
        monthlyDelinquentPeladaIds: res.monthlyDelinquentPeladaIds ?? [],
        accountActive: res.accountActive !== false,
      });
      await syncPeladaAfterLogin(res);
    },
    [syncPeladaAfterLogin],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res: LoginResult = await loginRequest({ email, password });
      await applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const changePassword = useCallback(
    async (senhaAtual: string, novaSenha: string) => {
      const res = await changePasswordRequest({ senhaAtual, novaSenha });
      await applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const refreshProfile = useCallback(async () => {
    const res = await fetchProfile();
    await applyLoginResult(res);
    return res;
  }, [applyLoginResult]);

  const updateMemberships = useCallback(
    async (payload: MembershipUpdatePayload) => {
      const res = await updateMembershipsRequest(payload);
      await applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const switchPelada = useCallback((id: number, name: string, hasLogo: boolean) => {
    setPeladaContext(id, name, hasLogo);
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return;
    }
    try {
      const u = JSON.parse(raw) as Record<string, unknown>;
      u.peladaId = id;
      u.peladaName = name;
      u.peladaHasLogo = hasLogo;
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setState((prev) => ({
        ...prev,
        peladaId: id,
        peladaName: name,
        peladaHasLogo: hasLogo,
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearPeladaContext();
    setState({
      token: null,
      email: null,
      name: null,
      roles: null,
      peladaId: null,
      peladaName: null,
      peladaHasLogo: null,
      mustChangePassword: false,
      membershipPeladaIds: [],
      monthlyDelinquentPeladaIds: [],
      accountActive: true,
    });
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      changePassword,
      refreshProfile,
      updateMemberships,
      switchPelada,
      logout,
      isAuthenticated: Boolean(state.token),
    }),
    [state, login, changePassword, refreshProfile, updateMemberships, switchPelada, logout],
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
