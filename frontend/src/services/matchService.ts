import { api } from '@/services/api';

export interface TeamScore {
  teamId: number;
  teamName: string;
  goals: number;
}

export interface Match {
  id: number;
  date: string;
  location: string;
  finishedAt?: string | null;
  peladaId?: number;
  teamScores?: TeamScore[];
}

/** Texto legível do placar (gols por equipe, a partir dos lances tipo Gol). */
export function formatMatchPlacar(scores: TeamScore[] | undefined | null): string {
  if (!scores?.length) return 'Sem equipes ou placar ainda';
  if (scores.length === 2) {
    const [a, b] = scores;
    return `${a.teamName} ${a.goals} × ${b.goals} ${b.teamName}`;
  }
  return scores.map((t) => `${t.teamName} ${t.goals}`).join(' · ');
}

export interface OpenMatchPayload {
  match: Match | null;
}

/** Partida em andamento (`finishedAt` nulo), a mais recente criada. */
export async function getCurrentOpenMatch(): Promise<Match | null> {
  const { data } = await api.get<OpenMatchPayload>('/matches/open');
  return data.match ?? null;
}

export async function listMatches(): Promise<Match[]> {
  const { data } = await api.get<Match[]>('/matches');
  return data;
}

/** Partidas encerradas (`finishedAt` preenchido), para vincular mídia. */
export async function listFinishedMatches(): Promise<Match[]> {
  const all = await listMatches();
  return all.filter((m) => m.finishedAt != null && m.finishedAt !== '');
}

export async function getMatch(id: number): Promise<Match> {
  const { data } = await api.get<Match>(`/matches/${id}`);
  return data;
}

export async function createMatch(body: { date: string; location: string }): Promise<Match> {
  const { data } = await api.post<Match>('/matches', body);
  return data;
}

export async function finishMatch(matchId: number): Promise<Match> {
  const { data } = await api.post<Match>(`/matches/${matchId}/finish`);
  return data;
}
