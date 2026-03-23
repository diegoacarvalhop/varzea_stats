import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appToast } from '@/lib/appToast';
import { requestPasswordReset } from '@/services/authService';
import styles from './LoginPage.module.scss';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Recuperar senha · VARzea Stats';
    return () => {
      document.title = 'VARzea Stats';
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      appToast.warning('Informe seu e-mail.');
      return;
    }
    setLoading(true);
    setMensagem(null);
    try {
      const r = await requestPasswordReset(email.trim());
      setMensagem(r.mensagem ?? 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.');
      setEmail('');
    } catch {
      appToast.error('Não foi possível enviar a solicitação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bgGlow} aria-hidden />
      <div className={styles.fieldLines} aria-hidden />
      <div className={styles.card}>
        <p className={styles.badge}>Acesso ao sistema</p>
        <h1 className={styles.title}>Esqueci a senha</h1>
        <p className={styles.subtitle}>
          Informe o e-mail da sua conta. Se estiver cadastrado, enviaremos um link para redefinir a senha (ou exibiremos o
          link no log do servidor se o e-mail não estiver configurado).
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          {mensagem && (
            <p className={styles.subtitle} style={{ color: 'var(--ok, #69f0ae)' }}>
              {mensagem}
            </p>
          )}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fp-email">
              E-mail
              <span className={styles.requiredMark} aria-hidden>
                *
              </span>
            </label>
            <input
              id="fp-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoComplete="email"
              disabled={Boolean(mensagem)}
            />
          </div>
          <button className={styles.submit} type="submit" disabled={loading || Boolean(mensagem)}>
            {loading ? 'Enviando…' : 'Enviar link'}
          </button>
          <p className={styles.subtitle} style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/login">Voltar ao login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
