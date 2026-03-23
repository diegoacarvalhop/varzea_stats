import { api } from '@/services/api';

export interface PlayerStats {
  playerId: number;
  playerName: string;
  teamId: number | null;
  teamName: string | null;
  goalkeeper: boolean;
  eventsByType: Record<string, number>;
  bolaCheiaVotes: number;
  bolaMurchaVotes: number;
}

export async function getPlayerStats(playerId: number): Promise<PlayerStats> {
  const { data } = await api.get<PlayerStats>(`/stats/player/${playerId}`);
  return data;
}
