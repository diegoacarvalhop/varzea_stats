import { api } from '@/services/api';
import type { Role } from '@/services/authService';

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  goalkeeper?: boolean;
  peladaId?: number | null;
  peladaName?: string | null;
  accountActive?: boolean;
  peladaIds?: number[];
  billingMonthlyByPelada?: Record<string, boolean>;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  roles: Role[];
  password: string;
  peladaId?: number | null;
  /** Só com perfil jogador: true = mensalista, false = diarista */
  billingMonthly?: boolean;
  /** Só com perfil jogador */
  goalkeeper?: boolean;
}

export interface UserPatchPayload {
  name?: string;
  email?: string;
  roles?: Role[];
  peladaId?: number | null;
  peladaIds?: number[];
  accountActive?: boolean;
  password?: string;
  /** true = mensalista, false = diarista; chaves são ids de pelada em string */
  billingMonthlyByPelada?: Record<string, boolean>;
  /** Só com perfil jogador */
  goalkeeper?: boolean;
}

export async function listUsers(): Promise<UserSummary[]> {
  const { data } = await api.get<UserSummary[]>('/users');
  return data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  const { data } = await api.post<UserSummary>('/users', payload);
  return data;
}

export async function patchUser(id: number, body: UserPatchPayload): Promise<UserSummary> {
  const { data } = await api.patch<UserSummary>(`/users/${id}`, body);
  return data;
}
