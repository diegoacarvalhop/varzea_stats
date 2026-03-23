/** Base da API (sem barra final). */
export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
}

/** URL absoluta da logomarca da pelada (GET público). */
export function peladaLogoAbsoluteUrl(peladaId: number): string {
  return `${getApiBaseUrl()}/peladas/${peladaId}/logo`;
}
