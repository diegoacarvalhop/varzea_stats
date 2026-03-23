import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';

export const appToast = {
  success(message: string) {
    toast.success(message);
  },
  error(message: string) {
    toast.error(message);
  },
  /** Aviso (tom neutro, ícone de alerta). */
  warning(message: string) {
    toast(message, { icon: '⚠️', duration: 4500 });
  },
  /** Erro de API com fallback se o servidor não enviar texto. */
  apiError(err: unknown, fallback: string) {
    toast.error(getApiErrorMessage(err, fallback));
  },
};
