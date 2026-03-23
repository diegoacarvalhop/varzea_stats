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
  teamScores?: TeamScore[];
}

export function formatMatchPlacar(scores: TeamScore[] | undefined | null): string {
  if (!scores?.length) return 'Sem equipes ou placar ainda';
  if (scores.length === 2) {
    const [a, b] = scores;
    return `${a.teamName} ${a.goals} × ${b.goals} ${b.teamName}`;
  }
  return scores.map((t) => `${t.teamName} ${t.goals}`).join(' · ');
}

export async function listMatches(): Promise<Match[]> {
  const { data } = await api.get<Match[]>('/matches');
  return data;
}
