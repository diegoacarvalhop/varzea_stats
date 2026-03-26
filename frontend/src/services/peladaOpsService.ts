import { api } from '@/services/api';

export interface DraftPlayerSlot {
  userId: number;
  userName: string;
  skillScore: number;
  goalkeeper?: boolean;
}

export interface DraftTeamLine {
  teamIndex: number;
  teamName: string;
  players: DraftPlayerSlot[];
}

export async function listPresence(peladaId: number, date: string): Promise<number[]> {
  const { data } = await api.get<number[]>(`/peladas/${peladaId}/presence`, { params: { date } });
  return data;
}

export async function savePresence(peladaId: number, body: { date: string; presentUserIds: number[] }): Promise<void> {
  await api.post(`/peladas/${peladaId}/presence`, body);
}

export async function runDraft(
  peladaId: number,
  body: {
    date: string;
    goalkeeperUserIds?: number[];
    goalkeeperByTeam?: Record<string, number>;
    teamNames?: string[];
    linePlayersPerTeam?: number;
  },
): Promise<DraftTeamLine[]> {
  const { data } = await api.post<DraftTeamLine[]>(`/peladas/${peladaId}/draft`, body);
  return data;
}

export async function getDraftResult(peladaId: number, date: string): Promise<DraftTeamLine[]> {
  const { data } = await api.get<DraftTeamLine[]>(`/peladas/${peladaId}/draft`, { params: { date } });
  return data;
}
