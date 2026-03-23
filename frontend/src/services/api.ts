import axios from 'axios';
import { getPeladaId } from '@/lib/peladaContext';
import type { Role } from '@/services/authService';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  const token = localStorage.getItem('varzea_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  let headerPelada: string | null = null;
  try {
    const raw = localStorage.getItem('varzea_user');
    if (raw) {
      const u = JSON.parse(raw) as {
        roles?: Role[];
        role?: Role;
        peladaId?: number | null;
      };
      const roles: Role[] =
        Array.isArray(u.roles) && u.roles.length > 0
          ? u.roles
          : u.role
            ? [u.role]
            : [];
      if (!roles.includes('ADMIN_GERAL') && u.peladaId != null) {
        headerPelada = String(u.peladaId);
      }
    }
  } catch {
    /* ignore */
  }
  if (!headerPelada) {
    headerPelada = getPeladaId();
  }
  if (headerPelada) {
    config.headers['X-Pelada-Id'] = headerPelada;
  }
  return config;
});
