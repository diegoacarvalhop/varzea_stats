const PELADA_ID_KEY = 'varzea_pelada_id';
const PELADA_NAME_KEY = 'varzea_pelada_name';
const PELADA_HAS_LOGO_KEY = 'varzea_pelada_has_logo';

/** ID da pelada em foco (admin ou visitante). Perfis não-admin usam a pelada da conta no interceptor. */
export function getPeladaId(): string | null {
  return localStorage.getItem(PELADA_ID_KEY);
}

export function setPeladaContext(id: number, name: string, hasLogo: boolean): void {
  localStorage.setItem(PELADA_ID_KEY, String(id));
  localStorage.setItem(PELADA_NAME_KEY, name);
  localStorage.setItem(PELADA_HAS_LOGO_KEY, hasLogo ? '1' : '0');
}

export function getPeladaName(): string | null {
  return localStorage.getItem(PELADA_NAME_KEY);
}

export function getPeladaHasLogo(): boolean {
  return localStorage.getItem(PELADA_HAS_LOGO_KEY) === '1';
}

export function clearPeladaContext(): void {
  localStorage.removeItem(PELADA_ID_KEY);
  localStorage.removeItem(PELADA_NAME_KEY);
  localStorage.removeItem(PELADA_HAS_LOGO_KEY);
}
