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

export interface TrajectoryMatchSlice {
  matchId: number;
  matchDate: string;
  matchLocation: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  blueCards: number;
  fouls: number;
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

export interface VoteRankingEntry {
  playerId: number;
  playerName: string;
  voteCount: number;
}

export interface VoteRanking {
  bolaCheia: VoteRankingEntry[];
  bolaMurcha: VoteRankingEntry[];
}

export async function getVoteRanking(limit = 20): Promise<VoteRanking> {
  const { data } = await api.get<VoteRanking>('/stats/ranking/votes', { params: { limit } });
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
