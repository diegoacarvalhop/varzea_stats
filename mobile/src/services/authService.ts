import { api, setAuthToken } from '@/services/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  email: string;
  name: string;
  roles?: string[];
  mustChangePassword?: boolean;
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>('/auth/login', payload);
  setAuthToken(data.token);
  return data;
}

export async function changePassword(payload: {
  senhaAtual: string;
  novaSenha: string;
}): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>('/auth/change-password', payload);
  setAuthToken(data.token);
  return data;
}

export function logout() {
  setAuthToken(null);
}
