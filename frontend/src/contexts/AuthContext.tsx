import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  clearPeladaContext,
  getPeladaHasLogo,
  getPeladaId,
  getPeladaName,
  setPeladaContext,
} from '@/lib/peladaContext';
import { isAdminGeral } from '@/lib/roles';
import type { LoginResult, MembershipUpdatePayload, ProfileUpdatePayload, Role } from '@/services/authService';
import {
  changePassword as changePasswordRequest,
  fetchProfile,
  login as loginRequest,
  updateProfile as updateProfileRequest,
  updateMemberships as updateMembershipsRequest,
} from '@/services/authService';
import { api } from '@/services/api';

const TOKEN_KEY = 'varzea_token';
const USER_KEY = 'varzea_user';

function base64UrlDecode(input: string): string {
  // JWT usa base64url (troca +/ por -_ e não garante padding).
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return atob(base64 + pad);
}

function getJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadRaw = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadRaw) as { exp?: unknown };
    if (typeof payload.exp === 'number') return payload.exp * 1000;
    if (typeof payload.exp === 'string') {
      const n = Number(payload.exp);
      return Number.isFinite(n) ? n * 1000 : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string): boolean {
  const expMs = getJwtExpMs(token);
  // Se não conseguir ler exp, tratamos como expirado para evitar redirects indevidos.
  if (expMs == null) return true;
  return expMs <= Date.now();
}

interface AuthState {
  token: string | null;
  email: string | null;
  name: string | null;
  roles: Role[] | null;
  peladaId: number | null;
  peladaName: string | null;
  /** Dia de vencimento da mensalidade na pelada do contexto (1–31); null sem pelada. */
  peladaMonthlyDueDay: number | null;
  peladaHasLogo: boolean | null;
  mustChangePassword: boolean;
  membershipPeladaIds: number[];
  monthlyDelinquentPeladaIds: number[];
  billingMonthlyByPelada: Record<string, boolean>;
  accountActive: boolean;
  goalkeeper: boolean;
}

function emptyAuthState(): AuthState {
  return {
    token: null,
    email: null,
    name: null,
    roles: null,
    peladaId: null,
    peladaName: null,
    peladaMonthlyDueDay: null,
    peladaHasLogo: null,
    mustChangePassword: false,
    membershipPeladaIds: [],
    monthlyDelinquentPeladaIds: [],
    billingMonthlyByPelada: {},
    accountActive: true,
    goalkeeper: false,
  };
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<LoginResult>;
  refreshProfile: () => Promise<LoginResult>;
  updateMemberships: (payload: MembershipUpdatePayload) => Promise<LoginResult>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<LoginResult>;
  switchPelada: (id: number, name: string, hasLogo: boolean, monthlyDueDay?: number | null) => void;
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

  if (token && isJwtExpired(token)) {
    // Token presente, mas expirado: limpa o estado local e evita redirecionar para rotas autenticadas.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return {
      token: null,
      email: null,
      name: null,
      roles: null,
      peladaId: null,
      peladaName: null,
      peladaMonthlyDueDay: null,
      peladaHasLogo: null,
      mustChangePassword: false,
      membershipPeladaIds: [],
      monthlyDelinquentPeladaIds: [],
      billingMonthlyByPelada: {},
      accountActive: true,
      goalkeeper: false,
    };
  }

  if (!token || !raw) {
    return {
      token: null,
      email: null,
      name: null,
      roles: null,
      peladaId: null,
      peladaName: null,
      peladaMonthlyDueDay: null,
      peladaHasLogo: null,
      mustChangePassword: false,
      membershipPeladaIds: [],
      monthlyDelinquentPeladaIds: [],
      billingMonthlyByPelada: {},
      accountActive: true,
      goalkeeper: false,
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
      peladaMonthlyDueDay?: number | null;
      peladaHasLogo?: boolean | null;
      mustChangePassword?: boolean;
      membershipPeladaIds?: number[];
      monthlyDelinquentPeladaIds?: number[];
      billingMonthlyByPelada?: Record<string, boolean>;
      accountActive?: boolean;
      goalkeeper?: boolean;
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
              peladaMonthlyDueDay: u.peladaMonthlyDueDay ?? 15,
            }),
          );
        }
      }
    }
    let peladaMonthlyDueDay: number | null = null;
    if (peladaId != null) {
      const d = u.peladaMonthlyDueDay;
      peladaMonthlyDueDay = typeof d === 'number' && d >= 1 && d <= 31 ? d : 15;
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
      peladaMonthlyDueDay,
      peladaHasLogo,
      mustChangePassword: Boolean(u.mustChangePassword),
      membershipPeladaIds: Array.isArray(u.membershipPeladaIds) ? u.membershipPeladaIds : [],
      monthlyDelinquentPeladaIds: Array.isArray(u.monthlyDelinquentPeladaIds)
        ? u.monthlyDelinquentPeladaIds
        : [],
      billingMonthlyByPelada:
        u.billingMonthlyByPelada && typeof u.billingMonthlyByPelada === 'object' ? u.billingMonthlyByPelada : {},
      accountActive: u.accountActive !== false,
      goalkeeper: u.goalkeeper === true,
    };
  } catch {
    return {
      token: null,
      email: null,
      name: null,
      roles: null,
      peladaId: null,
      peladaName: null,
      peladaMonthlyDueDay: null,
      peladaHasLogo: null,
      mustChangePassword: false,
      membershipPeladaIds: [],
      monthlyDelinquentPeladaIds: [],
      billingMonthlyByPelada: {},
      accountActive: true,
      goalkeeper: false,
    };
  }
}

function buildUserJson(res: LoginResult, mustChange: boolean) {
  const peladaMonthlyDueDay =
    res.peladaId != null
      ? typeof res.peladaMonthlyDueDay === 'number' &&
          res.peladaMonthlyDueDay >= 1 &&
          res.peladaMonthlyDueDay <= 31
        ? res.peladaMonthlyDueDay
        : 15
      : null;
  return {
    email: res.email,
    name: res.name,
    roles: res.roles,
    peladaId: res.peladaId ?? null,
    peladaName: res.peladaName ?? null,
    peladaMonthlyDueDay,
    peladaHasLogo: res.peladaHasLogo ?? null,
    mustChangePassword: mustChange,
    membershipPeladaIds: res.membershipPeladaIds ?? [],
    monthlyDelinquentPeladaIds: res.monthlyDelinquentPeladaIds ?? [],
    billingMonthlyByPelada: res.billingMonthlyByPelada ?? {},
    accountActive: res.accountActive !== false,
    goalkeeper: res.goalkeeper === true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(() => loadStored());
  /** Incrementado no logout; requisições antigas não podem reaplicar sessão após sair. */
  const authEpochRef = useRef(0);

  const syncPeladaAfterLogin = useCallback(async (res: LoginResult, epoch: number) => {
    if (epoch !== authEpochRef.current) {
      return;
    }
    if (res.roles.includes('ADMIN_GERAL')) {
      if (res.peladaId != null && res.peladaName) {
        setPeladaContext(res.peladaId, res.peladaName, Boolean(res.peladaHasLogo));
        return;
      }
      const ctxId = getPeladaId();
      const ctxName = getPeladaName();
      if (ctxId != null && ctxName != null && ctxId.length > 0) {
        const n = Number(ctxId);
        if (Number.isFinite(n)) {
          const hasLogo = getPeladaHasLogo();
          setState((prev) => ({
            ...prev,
            peladaId: n,
            peladaName: ctxName,
            peladaHasLogo: hasLogo,
            peladaMonthlyDueDay: prev.peladaMonthlyDueDay ?? 15,
          }));
          const raw = localStorage.getItem(USER_KEY);
          if (raw) {
            try {
              const u = JSON.parse(raw) as Record<string, unknown>;
              u.peladaId = n;
              u.peladaName = ctxName;
              u.peladaHasLogo = hasLogo;
              if (u.peladaMonthlyDueDay == null) {
                u.peladaMonthlyDueDay = 15;
              }
              localStorage.setItem(USER_KEY, JSON.stringify(u));
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      clearPeladaContext();
      return;
    }
    if (res.peladaId != null && res.peladaName) {
      setPeladaContext(res.peladaId, res.peladaName, Boolean(res.peladaHasLogo));
      return;
    }
    const mids = res.membershipPeladaIds ?? [];
    if (mids.length > 0) {
      try {
        const { data } = await api.get<
          Array<{ id: number; name: string; hasLogo: boolean; monthlyDueDay?: number | null }>
        >('/peladas');
        if (epoch !== authEpochRef.current) {
          return;
        }
        const firstId = mids[0];
        const p = data.find((x) => x.id === firstId);
        if (p) {
          const due =
            typeof p.monthlyDueDay === 'number' && p.monthlyDueDay >= 1 && p.monthlyDueDay <= 31
              ? p.monthlyDueDay
              : 15;
          setPeladaContext(p.id, p.name, Boolean(p.hasLogo));
          const raw = localStorage.getItem(USER_KEY);
          if (raw) {
            const u = JSON.parse(raw) as Record<string, unknown>;
            u.peladaId = p.id;
            u.peladaName = p.name;
            u.peladaHasLogo = p.hasLogo;
            u.peladaMonthlyDueDay = due;
            localStorage.setItem(USER_KEY, JSON.stringify(u));
          }
          setState((prev) => ({
            ...prev,
            peladaId: p.id,
            peladaName: p.name,
            peladaHasLogo: p.hasLogo,
            peladaMonthlyDueDay: due,
          }));
        }
      } catch {
        if (epoch === authEpochRef.current) {
          clearPeladaContext();
        }
      }
      return;
    }
    clearPeladaContext();
  }, []);

  const applyLoginResult = useCallback(
    async (res: LoginResult) => {
      const epoch = authEpochRef.current;
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
        peladaMonthlyDueDay:
          res.peladaId != null
            ? typeof res.peladaMonthlyDueDay === 'number' &&
                res.peladaMonthlyDueDay >= 1 &&
                res.peladaMonthlyDueDay <= 31
              ? res.peladaMonthlyDueDay
              : 15
            : null,
        peladaHasLogo: res.peladaHasLogo ?? null,
        mustChangePassword: mustChange,
        membershipPeladaIds: res.membershipPeladaIds ?? [],
        monthlyDelinquentPeladaIds: res.monthlyDelinquentPeladaIds ?? [],
        billingMonthlyByPelada: res.billingMonthlyByPelada ?? {},
        accountActive: res.accountActive !== false,
        goalkeeper: res.goalkeeper === true,
      });
      await syncPeladaAfterLogin(res, epoch);
      if (epoch !== authEpochRef.current) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        clearPeladaContext();
        flushSync(() => {
          setState(emptyAuthState());
        });
      }
    },
    [syncPeladaAfterLogin],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const epoch = authEpochRef.current;
      const res: LoginResult = await loginRequest({ email, password });
      if (epoch !== authEpochRef.current) {
        return res;
      }
      await applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const changePassword = useCallback(
    async (senhaAtual: string, novaSenha: string) => {
      const epoch = authEpochRef.current;
      const res = await changePasswordRequest({ senhaAtual, novaSenha });
      if (epoch !== authEpochRef.current) {
        return res;
      }
      await applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const refreshProfile = useCallback(async () => {
    const epoch = authEpochRef.current;
    const res = await fetchProfile();
    if (epoch !== authEpochRef.current) {
      return res;
    }
    await applyLoginResult(res);
    return res;
  }, [applyLoginResult]);

  const updateMemberships = useCallback(
    async (payload: MembershipUpdatePayload) => {
      const epoch = authEpochRef.current;
      const res = await updateMembershipsRequest(payload);
      if (epoch !== authEpochRef.current) {
        return res;
      }
      await applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const updateProfile = useCallback(
    async (payload: ProfileUpdatePayload) => {
      const epoch = authEpochRef.current;
      const res = await updateProfileRequest(payload);
      if (epoch !== authEpochRef.current) {
        return res;
      }
      await applyLoginResult(res);
      return res;
    },
    [applyLoginResult],
  );

  const switchPelada = useCallback((id: number, name: string, hasLogo: boolean, monthlyDueDay?: number | null) => {
    setPeladaContext(id, name, hasLogo);
    const raw = localStorage.getItem(USER_KEY);
    const nextDue =
      monthlyDueDay === undefined
        ? undefined
        : typeof monthlyDueDay === 'number' && monthlyDueDay >= 1 && monthlyDueDay <= 31
          ? monthlyDueDay
          : 15;
    if (!raw) {
      if (nextDue !== undefined) {
        setState((prev) => ({ ...prev, peladaId: id, peladaName: name, peladaHasLogo: hasLogo, peladaMonthlyDueDay: nextDue }));
      } else {
        setState((prev) => ({ ...prev, peladaId: id, peladaName: name, peladaHasLogo: hasLogo }));
      }
      return;
    }
    try {
      const u = JSON.parse(raw) as Record<string, unknown>;
      u.peladaId = id;
      u.peladaName = name;
      u.peladaHasLogo = hasLogo;
      if (nextDue !== undefined) {
        u.peladaMonthlyDueDay = nextDue;
      }
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setState((prev) => ({
        ...prev,
        peladaId: id,
        peladaName: name,
        peladaHasLogo: hasLogo,
        ...(nextDue !== undefined ? { peladaMonthlyDueDay: nextDue } : {}),
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    authEpochRef.current += 1;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearPeladaContext();
    // Atualiza o estado antes do navigate para evitar que /login ainda veja isAuthenticated e redirecione de volta ao painel.
    flushSync(() => {
      setState(emptyAuthState());
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
      updateProfile,
      switchPelada,
      logout,
      isAuthenticated: Boolean(state.token),
    }),
    [state, login, changePassword, refreshProfile, updateMemberships, updateProfile, switchPelada, logout],
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
