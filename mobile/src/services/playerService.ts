import { api } from '@/services/api';

export interface PlayerDirectoryEntry {
  playerId: number;
  playerName: string;
  teamName: string | null;
  matchId: number | null;
  matchDate: string | null;
  matchLocation: string | null;
  goalkeeper: boolean;
}

export function formatPlayerDirectoryLabel(e: PlayerDirectoryEntry): string {
  const parts: string[] = [e.playerName];
  if (e.teamName) parts.push(e.teamName);
  if (e.matchId != null) parts.push(`Partida #${e.matchId}`);
  if (e.matchDate) {
    parts.push(
      new Date(e.matchDate).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    );
  }
  if (e.matchLocation) parts.push(e.matchLocation);
  if (e.goalkeeper) parts.push('Goleiro');
  return parts.join(' · ');
}

export async function listPlayersDirectory(): Promise<PlayerDirectoryEntry[]> {
  const { data } = await api.get<PlayerDirectoryEntry[]>('/players');
  return data;
}
