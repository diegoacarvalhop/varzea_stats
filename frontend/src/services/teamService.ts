import { api } from '@/services/api';

export interface Team {
  id: number;
  name: string;
  matchId: number;
}

export async function listTeamsByMatch(matchId: number): Promise<Team[]> {
  const { data } = await api.get<Team[]>(`/matches/${matchId}/teams`);
  return data;
}

export async function createTeamForMatch(matchId: number, name: string): Promise<Team> {
  const { data } = await api.post<Team>(`/matches/${matchId}/teams`, { name });
  return data;
}
