/**
 * Extrai mensagem amigável de erro de resposta Axios ou Error lançada no cliente.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && !/^Request failed with status code \d+$/i.test(err.message)) {
    return err.message;
  }
  const ax = err as { response?: { data?: { error?: string } } };
  const server = ax.response?.data?.error;
  if (typeof server === 'string' && server.trim()) {
    return server.trim();
  }
  return fallback;
}
