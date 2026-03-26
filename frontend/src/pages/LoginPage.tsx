import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import { getPeladaId } from '@/lib/peladaContext';
import { hasRole, isAdminGeral } from '@/lib/roles';
import type { Role } from '@/services/authService';
import { PasswordField } from '@/components/PasswordField';
import styles from './LoginPage.module.scss';

function parseStoredRoles(raw: string | null): Role[] {
  if (!raw) return [];
  try {
    const u = JSON.parse(raw) as { roles?: Role[]; role?: Role };
    if (Array.isArray(u.roles) && u.roles.length > 0) return u.roles;
    if (u.role) return [u.role];
  } catch {
    /* ignore */
  }
  return [];
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/painel';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Entrar · VARzea Stats';
    return () => {
      document.title = 'VARzea Stats';
    };
  }, []);

  // Alinhar com o token persistido: após logout o localStorage some antes de um possível render atrasado do contexto.
  const hasPersistedToken = Boolean(localStorage.getItem('varzea_token'));
  if (isAuthenticated && hasPersistedToken) {
    const storedRoles = parseStoredRoles(localStorage.getItem('varzea_user'));
    if (isAdminGeral(storedRoles) && !getPeladaId()) {
      return <Navigate to="/pelada" replace />;
    }
    if (hasRole(storedRoles, 'ADMIN') && !isAdminGeral(storedRoles)) {
      const raw = localStorage.getItem('varzea_user');
      try {
        const u = raw ? (JSON.parse(raw) as { peladaId?: number | null }) : {};
        if (u.peladaId == null) {
          return <Navigate to="/pelada" replace />;
        }
      } catch {
        return <Navigate to="/pelada" replace />;
      }
    }
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password);
      appToast.success('Login realizado.');
      if (res.mustChangePassword) {
        navigate('/alterar-senha', { replace: true });
        return;
      }
      const raw = localStorage.getItem('varzea_user');
      const roles = parseStoredRoles(raw);
      if (isAdminGeral(roles)) {
        navigate(getPeladaId() ? '/painel' : '/pelada', { replace: true });
        return;
      }
      if (hasRole(roles, 'ADMIN') && res.peladaId == null) {
        navigate('/pelada', { replace: true });
        return;
      }
      navigate(from, { replace: true });
    } catch {
      appToast.error('Falha no login. Verifique e-mail e senha.');
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
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>
          VARzea Stats — análise de partidas em tempo real.{' '}
          <Link to="/">Voltar ao início</Link>
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              E-mail
              <span className={styles.requiredMark} aria-hidden>
                *
              </span>
            </label>
            <input
              id="login-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <PasswordField
            id="login-password"
            label="Senha"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Acessar painel'}
          </button>
          <p className={styles.subtitle} style={{ marginTop: '1rem', marginBottom: 0, textAlign: 'center' }}>
            <Link to="/esqueci-senha">Esqueci minha senha</Link>
          </p>
          <p className={styles.subtitle} style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            <Link to="/cadastro">Realizar cadastro</Link>
          </p>
          <p className={styles.subtitle} style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            <Link to="/">Voltar ao início</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
