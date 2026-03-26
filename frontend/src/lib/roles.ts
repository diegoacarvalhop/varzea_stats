import type { Role } from '@/services/authService';

/** Nome do perfil para exibição na interface (português). */
export const ROLE_DISPLAY_LABEL: Record<Role, string> = {
  ADMIN_GERAL: 'Administrador geral',
  ADMIN: 'Administrador',
  SCOUT: 'Scout / mesário',
  MEDIA: 'Mídia',
  FINANCEIRO: 'Financeiro',
  PLAYER: 'Jogador',
};

export function roleDisplayLabel(role: Role): string {
  return ROLE_DISPLAY_LABEL[role] ?? role;
}

export function hasRole(userRoles: Role[] | null | undefined, role: Role): boolean {
  return Boolean(userRoles?.includes(role));
}

export function hasAnyRole(userRoles: Role[] | null | undefined, candidates: readonly Role[]): boolean {
  if (!userRoles?.length) return false;
  return candidates.some((c) => userRoles.includes(c));
}

export function isAdminGeral(userRoles: Role[] | null | undefined): boolean {
  return hasRole(userRoles, 'ADMIN_GERAL');
}

export function isAdminPelada(userRoles: Role[] | null | undefined): boolean {
  return hasRole(userRoles, 'ADMIN');
}

export function isAnyAdmin(userRoles: Role[] | null | undefined): boolean {
  return isAdminGeral(userRoles) || isAdminPelada(userRoles);
}

/** Pode criar/encerrar partida. */
export const MATCH_MANAGER_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN', 'SCOUT', 'MEDIA'];

/** Pode criar equipes e jogadores na partida. */
export const ROSTER_EDITOR_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN', 'SCOUT'];

/** Pode registrar lances. */
export const EVENT_RECORDER_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN', 'SCOUT', 'MEDIA'];

/** Mídia anexada à partida. */
export const MEDIA_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN', 'MEDIA'];

/** Tela de usuários. */
export const USER_ADMIN_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN'];

export const FINANCE_MODULE_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN', 'FINANCEIRO', 'PLAYER'];

export const PELADA_SETTINGS_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN'];

export const PRESENCE_DRAFT_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN', 'SCOUT'];

/** Bola cheia / bola murcha na página de ranking. */
export const BOLA_VOTE_ROLES: Role[] = ['ADMIN_GERAL', 'ADMIN', 'PLAYER'];
