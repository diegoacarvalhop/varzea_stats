import { api } from '@/services/api';

export interface PlayerStats {
  playerId: number;
  playerName: string;
  teamId: number | null;
  teamName: string | null;
  goalkeeper: boolean;
  goalsConceded: number;
  foulsSuffered: number;
  eventsByType: Record<string, number>;
}

export async function getPlayerStats(playerId: number): Promise<PlayerStats> {
  const { data } = await api.get<PlayerStats>(`/stats/player/${playerId}`);
  return data;
}

export interface TrajectoryMatchSlice {
  matchId: number;
  matchDate: string;
  matchLocation: string;
  goals: number;
  ownGoals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  blueCards: number;
  fouls: number;
  penalties: number;
  foulsSuffered: number;
  otherEvents: number;
  goalsConceded: number;
}

export interface TrajectoryCumulativePoint {
  matchId: number;
  matchDate: string;
  cumulativeGoals: number;
  cumulativeAssists: number;
}

export interface PlayerTrajectoryForecast {
  averageGoalsPerMatch?: number;
  estimatedGoalsNextMatch?: number | null;
  averageAssistsPerMatch?: number;
  estimatedAssistsNextMatch?: number | null;
  averageByEventPerMatch?: Record<string, number>;
  estimatedByEventNextMatch?: Record<string, number>;
  goalsTrendLabel: string;
  narrative: string;
  methodologyNote: string;
}

export interface PlayerTrajectory {
  groupedByPlayerName: string;
  matchesWithEvents: number;
  byMatch: TrajectoryMatchSlice[];
  cumulativeByMatch: TrajectoryCumulativePoint[];
  forecast: PlayerTrajectoryForecast;
}

export async function getPlayerTrajectory(playerId: number): Promise<PlayerTrajectory> {
  const { data } = await api.get<PlayerTrajectory>(`/stats/player/${playerId}/trajectory`);
  return data;
}

export interface LanceRankingEntry {
  playerId: number;
  playerName: string;
  eventCount: number;
}

export interface LanceRankingBlock {
  eventType: string;
  label: string;
  entries: LanceRankingEntry[];
}

export interface LanceRankings {
  blocks: LanceRankingBlock[];
}

export async function getLanceRankings(limit = 20): Promise<LanceRankings> {
  const { data } = await api.get<LanceRankings>('/stats/ranking/lances', { params: { limit } });
  return data;
}

/** Dados agregados da página de ranking (uma requisição lógica; deduplica chamadas duplicadas do React Strict Mode). */
export interface RankingPageBundle {
  lanceRankings: LanceRankings | null;
  failed: string[];
}

let rankingBundleInFlight: Promise<RankingPageBundle> | null = null;

export async function fetchRankingPageBundle(): Promise<RankingPageBundle> {
  if (!rankingBundleInFlight) {
    rankingBundleInFlight = getLanceRankings(30)
      .then((lanceRankings) => {
        rankingBundleInFlight = null;
        return {
          lanceRankings,
          failed: [],
        };
      })
      .catch(() => {
        rankingBundleInFlight = null;
        return {
          lanceRankings: null,
          failed: ['ranking de lances'],
        };
      });
  }
  return rankingBundleInFlight;
}
