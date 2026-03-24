import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PasswordField } from '@/components/PasswordField';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { appToast } from '@/lib/appToast';
import { registerPublicAccount } from '@/services/authService';
import { listPeladas } from '@/services/peladaService';
import styles from './LoginPage.module.scss';

export function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [peladaNome, setPeladaNome] = useState<string | null>(null);
  const peladaIdParam = searchParams.get('peladaId');
  const peladaId = peladaIdParam ? Number(peladaIdParam) : NaN;
  const cadastroAdmin = searchParams.get('tipo') === 'admin' || !Number.isFinite(peladaId);

  useEffect(() => {
    document.title = 'Cadastro · VARzea Stats';
    return () => {
      document.title = 'VARzea Stats';
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(peladaId)) {
      setPeladaNome(null);
      return;
    }
    void listPeladas()
      .then((list) => {
        const p = list.find((x) => x.id === peladaId);
        setPeladaNome(p?.name ?? null);
      })
      .catch(() => setPeladaNome(null));
  }, [peladaId]);

  if (isAuthenticated) {
    return <Navigate to="/painel" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      appToast.warning('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      appToast.warning('A confirmação não coincide com a senha.');
      return;
    }
    setLoading(true);
    try {
      await registerPublicAccount({
        name: name.trim(),
        email: email.trim(),
        password,
        peladaId: Number.isFinite(peladaId) ? peladaId : null,
      });
      appToast.success(
        cadastroAdmin
          ? 'Conta ADMIN criada. Faça login para criar a pelada e concluir seu acesso.'
          : 'Conta de jogador criada. Faça login para entrar na pelada.',
      );
      navigate('/login', { replace: true });
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível concluir o cadastro.'));
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
        <h1 className={styles.title}>Realizar cadastro</h1>
        <p className={styles.subtitle}>
          {cadastroAdmin ? (
            <>
              Este cadastro cria sua conta como <strong>ADMIN</strong> para criar uma nova pelada.
            </>
          ) : (
            <>
              Este cadastro cria sua conta como <strong>JOGADOR</strong> para entrar na pelada{' '}
              <strong>{peladaNome ?? `#${peladaId}`}</strong>.
            </>
          )}
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-name">
              Nome
              <span className={styles.requiredMark} aria-hidden>
                *
              </span>
            </label>
            <input
              id="reg-name"
              className={styles.input}
              type="text"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-email">
              E-mail (será seu login)
              <span className={styles.requiredMark} aria-hidden>
                *
              </span>
            </label>
            <input
              id="reg-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <PasswordField
            id="reg-pass"
            label="Senha"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            minLength={6}
            showStrengthMeter
          />
          <PasswordField
            id="reg-pass2"
            label="Confirmar senha"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
            minLength={6}
          />
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Cadastrando…' : 'Criar conta'}
          </button>
          <p className={styles.subtitle} style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/login">Já tenho conta — entrar</Link>
          </p>
          <p className={styles.subtitle} style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            <Link to="/">Voltar ao início</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
