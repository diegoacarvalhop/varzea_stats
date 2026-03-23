import { api } from '@/services/api';
import type { Role } from '@/services/authService';

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  peladaId?: number | null;
  peladaName?: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  roles: Role[];
  /** Obrigatório exceto quando o único perfil é ADMIN_GERAL. */
  peladaId?: number | null;
}

export async function listUsers(): Promise<UserSummary[]> {
  const { data } = await api.get<UserSummary[]>('/users');
  return data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const { data } = await api.post<UserSummary>('/users', payload);
  return data;
}
