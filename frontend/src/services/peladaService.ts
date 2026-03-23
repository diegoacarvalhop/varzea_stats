import { api } from '@/services/api';

export interface Pelada {
  id: number;
  name: string;
  createdAt: string;
  hasLogo: boolean;
}

export async function listPeladas(): Promise<Pelada[]> {
  const { data } = await api.get<Pelada[]>('/peladas');
  return data;
}

export async function createPelada(name: string, logo?: File | null): Promise<Pelada> {
  if (logo) {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('logo', logo);
    const { data } = await api.post<Pelada>('/peladas', fd);
    return data;
  }
  const { data } = await api.post<Pelada>('/peladas', { name });
  return data;
}
