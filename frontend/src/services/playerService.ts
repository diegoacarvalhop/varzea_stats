import { api } from '@/services/api';

/** Jogador em alguma equipe de alguma partida (para selects em votação e estatísticas). */
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

export async function listPlayersDirectory(opts?: {
  /** Inclui usuários com vínculo em user_pelada (cadastro na pelada), ainda sem ficha em partida. */
  includePeladaMembers?: boolean;
}): Promise<PlayerDirectoryEntry[]> {
  const { data } = await api.get<PlayerDirectoryEntry[]>('/players', {
    params: {
      includePeladaMembers: opts?.includePeladaMembers === true ? true : undefined,
    },
  });
  return data;
}

export interface Player {
  id: number;
  name: string;
  teamId: number | null;
  teamName: string | null;
  goalkeeper: boolean;
}

export async function listPlayersByMatch(matchId: number): Promise<Player[]> {
  const { data } = await api.get<Player[]>(`/matches/${matchId}/players`);
  return data;
}

export async function applyDraftToMatch(
  matchId: number,
  body: {
    lines: { teamName: string; slots: { userId: number; goalkeeper: boolean }[] }[];
  },
): Promise<void> {
  await api.post(`/matches/${matchId}/players/apply-draft`, body);
}
