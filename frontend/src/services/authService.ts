import { api } from '@/services/api';

export interface PublicRegisterPayload {
  name: string;
  email: string;
  password: string;
  peladaId?: number | null;
  billingMonthly?: boolean;
  goalkeeper?: boolean;
}

export type Role = 'ADMIN_GERAL' | 'ADMIN' | 'SCOUT' | 'PLAYER' | 'MEDIA' | 'FINANCEIRO';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  email: string;
  name: string;
  roles: Role[];
  peladaId?: number | null;
  peladaName?: string | null;
  /** Dia de vencimento da mensalidade na pelada do contexto (1–31). */
  peladaMonthlyDueDay?: number | null;
  peladaHasLogo?: boolean | null;
  mustChangePassword?: boolean;
  membershipPeladaIds?: number[];
  monthlyDelinquentPeladaIds?: number[];
  billingMonthlyByPelada?: Record<string, boolean>;
  accountActive?: boolean;
  goalkeeper?: boolean;
}

export interface MembershipUpdatePayload {
  peladaIds: number[];
  billingMonthlyByPelada?: Record<string, boolean>;
}

export interface ProfileUpdatePayload {
  name: string;
  email: string;
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>('/auth/login', payload);
  return data;
}

export async function fetchProfile(): Promise<LoginResult> {
  const { data } = await api.get<LoginResult>('/auth/me');
  return data;
}

export async function updateMemberships(payload: MembershipUpdatePayload): Promise<LoginResult> {
  const { data } = await api.put<LoginResult>('/auth/me/memberships', payload);
  return data;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<LoginResult> {
  const { data } = await api.put<LoginResult>('/auth/me', payload);
  return data;
}

export async function changePassword(payload: {
  senhaAtual: string;
  novaSenha: string;
}): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>('/auth/change-password', payload);
  return data;
}

export async function requestPasswordReset(email: string): Promise<{ mensagem: string }> {
  const { data } = await api.post<{ mensagem: string }>('/auth/esqueci-senha', { email });
  return data;
}

export async function resetPasswordWithToken(token: string, novaSenha: string): Promise<{ mensagem: string }> {
  const { data } = await api.post<{ mensagem: string }>('/auth/redefinir-senha', { token, novaSenha });
  return data;
}

export async function registerPublicAccount(payload: PublicRegisterPayload): Promise<void> {
  await api.post('/auth/cadastro', payload);
}
