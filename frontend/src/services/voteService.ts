import { api } from '@/services/api';

export type VoteType = 'BOLA_CHEIA' | 'BOLA_MURCHA';

export async function submitVote(playerId: number, type: VoteType): Promise<{ id: number }> {
  const { data } = await api.post<{ id: number }>('/votes', { playerId, type });
  return data;
}
