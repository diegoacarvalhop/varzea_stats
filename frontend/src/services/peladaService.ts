import { api } from '@/services/api';

export interface Pelada {
  id: number;
  name: string;
  createdAt: string;
  hasLogo: boolean;
  active?: boolean;
  location?: string | null;
  scheduleLabel?: string | null;
  scheduleTime?: string | null;
  scheduleWeekdays?: number[] | null;
  scheduleLegacyLabel?: string | null;
  monthlyFeeCents?: number | null;
  dailyFeeCents?: number | null;
  teamCount?: number | null;
  teamNames?: string | null;
  matchDurationMinutes?: number | null;
  matchGoalsToEnd?: number | null;
}

export interface PeladaPublicCard {
  id: number;
  name: string;
  playerCount: number;
  location: string | null;
  scheduleLabel: string | null;
  createdAt: string;
  hasLogo: boolean;
}

export interface PeladaSettingsPayload {
  active?: boolean;
  location?: string | null;
  scheduleTime?: string | null;
  scheduleWeekdays?: number[] | null;
  monthlyFeeCents?: number | null;
  dailyFeeCents?: number | null;
  teamCount?: number | null;
  teamNames?: string | null;
  matchDurationMinutes?: number | null;
  matchGoalsToEnd?: number | null;
}

export async function getPublicPeladaCards(): Promise<PeladaPublicCard[]> {
  const { data } = await api.get<PeladaPublicCard[]>('/peladas/public-cards');
  return data;
}

export async function listPeladas(): Promise<Pelada[]> {
  const { data } = await api.get<Pelada[]>('/peladas');
  return data;
}

export async function updatePeladaSettings(id: number, body: PeladaSettingsPayload): Promise<Pelada> {
  const { data } = await api.put<Pelada>(`/peladas/${id}/settings`, body);
  return data;
}

export async function createPelada(name: string, logo?: File | null): Promise<Pelada> {
  if (logo) {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('logo', logo);
    const { data } = await api.post<Pelada>('/peladas', fd);
    return data;
  }
  const { data } = await api.post<Pelada>('/peladas', { name });
  return data;
}
