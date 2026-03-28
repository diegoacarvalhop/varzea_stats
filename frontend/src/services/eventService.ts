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
  /** Segundos decorridos no cronômetro (crescente) ao registrar o lance. */
  clockElapsedSeconds?: number | null;
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
    clockElapsedSeconds?: number | null;
  },
): Promise<MatchEvent> {
  const body = {
    type: payload.type,
    playerId: payload.playerId ?? undefined,
    targetId: payload.targetId ?? undefined,
    clockElapsedSeconds:
      payload.clockElapsedSeconds != null && Number.isFinite(payload.clockElapsedSeconds)
        ? Math.max(0, Math.floor(payload.clockElapsedSeconds))
        : undefined,
  };
  const { data } = await api.post<MatchEvent>(`/matches/${matchId}/events`, body);
  return data;
}

export async function deleteEventForMatch(matchId: number, eventId: number): Promise<void> {
  await api.delete(`/matches/${matchId}/events/${eventId}`);
}
