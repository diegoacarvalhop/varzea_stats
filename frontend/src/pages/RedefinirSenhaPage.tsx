import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { appToast } from '@/lib/appToast';
import { PasswordField } from '@/components/PasswordField';
import { resetPasswordWithToken } from '@/services/authService';
import styles from './LoginPage.module.scss';

export function RedefinirSenhaPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    document.title = 'Nova senha · VARzea Stats';
    return () => {
      document.title = 'VARzea Stats';
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 6) {
      appToast.warning('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      appToast.warning('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithToken(token, novaSenha);
      setSucesso(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch {
      appToast.error('Token inválido ou expirado. Solicite um novo link.');
    } finally {
      setLoading(false);
    }
  }

  if (!token.trim()) {
    return (
      <div className={styles.root}>
        <div className={styles.bgGlow} aria-hidden />
        <div className={styles.fieldLines} aria-hidden />
        <div className={styles.card}>
          <h1 className={styles.title}>Link inválido</h1>
          <p className={styles.subtitle}>Use o link enviado por e-mail ou solicite uma nova redefinição.</p>
          <p className={styles.subtitle}>
            <Link to="/esqueci-senha">Esqueci a senha</Link> · <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className={styles.root}>
        <div className={styles.bgGlow} aria-hidden />
        <div className={styles.fieldLines} aria-hidden />
        <div className={styles.card}>
          <h1 className={styles.title}>Senha alterada</h1>
          <p className={styles.subtitle}>Redirecionando para o login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.bgGlow} aria-hidden />
      <div className={styles.fieldLines} aria-hidden />
      <div className={styles.card}>
        <p className={styles.badge}>Recuperação</p>
        <h1 className={styles.title}>Definir nova senha</h1>
        <p className={styles.subtitle}>Escolha uma senha com pelo menos 6 caracteres.</p>
        <form className={styles.form} onSubmit={onSubmit}>
          <PasswordField
            id="rs-nova"
            label="Nova senha"
            value={novaSenha}
            onChange={setNovaSenha}
            autoComplete="new-password"
            required
            minLength={6}
            showStrengthMeter
          />
          <PasswordField
            id="rs-conf"
            label="Confirmar senha"
            value={confirmar}
            onChange={setConfirmar}
            autoComplete="new-password"
            required
            minLength={6}
          />
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Salvando…' : 'Redefinir senha'}
          </button>
          <p className={styles.subtitle} style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/login">Voltar ao login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
