import { beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { appToast } from '@/lib/appToast';

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('appToast', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('success chama toast.success', () => {
    appToast.success('ok');
    expect(toast.success).toHaveBeenCalledWith('ok');
  });

  it('apiError usa mensagem do servidor', () => {
    appToast.apiError({ response: { data: { error: 'Falha API' } } }, 'fallback');
    expect(toast.error).toHaveBeenCalledWith('Falha API');
  });

  it('apiError usa fallback', () => {
    appToast.apiError(new Error('Request failed with status code 500'), 'fallback');
    expect(toast.error).toHaveBeenCalledWith('fallback');
  });
});
