import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from '@/lib/apiError';

describe('getApiErrorMessage', () => {
  it('usa mensagem de Error quando não é genérica de axios', () => {
    expect(getApiErrorMessage(new Error('Sessão expirada'), 'fallback')).toBe('Sessão expirada');
  });

  it('ignora mensagem genérica de status HTTP e usa fallback', () => {
    expect(
      getApiErrorMessage(new Error('Request failed with status code 401'), 'fallback'),
    ).toBe('fallback');
  });

  it('extrai campo error do corpo axios', () => {
    const err = { response: { data: { error: ' E-mail já cadastrado ' } } };
    expect(getApiErrorMessage(err, 'fallback')).toBe('E-mail já cadastrado');
  });

  it('retorna fallback quando não há mensagem útil', () => {
    expect(getApiErrorMessage({}, 'padrão')).toBe('padrão');
  });
});
