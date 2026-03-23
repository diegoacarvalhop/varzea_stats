import { api } from '@/services/api';

export interface PublicRegisterPayload {
  name: string;
  email: string;
  peladaId: number;
}

export type Role = 'ADMIN_GERAL' | 'ADMIN' | 'SCOUT' | 'PLAYER' | 'MEDIA';

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
  peladaHasLogo?: boolean | null;
  mustChangePassword?: boolean;
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>('/auth/login', payload);
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

/** Cadastro público (perfil jogador, senha padrão do sistema, troca obrigatória no 1º acesso). */
export async function registerPublicAccount(payload: PublicRegisterPayload): Promise<void> {
  await api.post('/auth/cadastro', payload);
}
