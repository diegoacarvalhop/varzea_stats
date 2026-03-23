import { api } from '@/services/api';

export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';

export interface MatchMediaItem {
  id: number;
  url: string;
  type: MediaType;
  matchId: number;
}

export async function listMediaForMatch(matchId: number): Promise<MatchMediaItem[]> {
  const { data } = await api.get<MatchMediaItem[]>(`/matches/${matchId}/media`);
  return data;
}

export async function uploadMedia(body: {
  url: string;
  type: MediaType;
  matchId: number;
}): Promise<MatchMediaItem> {
  const { data } = await api.post<MatchMediaItem>('/media/upload', body);
  return data;
}
