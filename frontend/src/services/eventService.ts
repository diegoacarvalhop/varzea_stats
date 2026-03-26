import { api } from '@/services/api';

export type EventType =
  | 'GOAL'
  | 'OWN_GOAL'
  | 'ASSIST'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'BLUE_CARD'
  | 'FOUL'
  | 'PENALTY_PLAY'
  | 'PENALTY'
  | 'SUBSTITUTION'
  | 'OTHER';

export interface MatchEvent {
  id: number;
  type: EventType;
  playerId: number | null;
  targetId: number | null;
  matchId: number;
}

export async function listEventsByMatch(matchId: number): Promise<MatchEvent[]> {
  const { data } = await api.get<MatchEvent[]>(`/matches/${matchId}/events`);
  return data;
}

export async function createEventForMatch(
  matchId: number,
  payload: {
    type: EventType;
    playerId?: number | null;
    targetId?: number | null;
  },
): Promise<MatchEvent> {
  const body = {
    type: payload.type,
    playerId: payload.playerId ?? undefined,
    targetId: payload.targetId ?? undefined,
  };
  const { data } = await api.post<MatchEvent>(`/matches/${matchId}/events`, body);
  return data;
}
