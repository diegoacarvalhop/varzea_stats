import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { appToast } from '@/lib/appToast';
import { getPeladaId } from '@/lib/peladaContext';
import { registerPublicAccount } from '@/services/authService';
import { listPeladas, type Pelada } from '@/services/peladaService';
import styles from './LoginPage.module.scss';

export function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [peladaId, setPeladaId] = useState<string>(() => getPeladaId() ?? '');
  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [peladasFailed, setPeladasFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Cadastro · VARzea Stats';
    return () => {
      document.title = 'VARzea Stats';
    };
  }, []);

  const loadPeladas = useCallback(async () => {
    setPeladasFailed(false);
    try {
      const list = await listPeladas();
      setPeladas(list);
    } catch {
      setPeladasFailed(true);
      appToast.error('Não foi possível carregar as peladas.');
    }
  }, []);

  useEffect(() => {
    void loadPeladas();
  }, [loadPeladas]);

  const peladaSelectOptions = useMemo(
    () =>
      [...peladas]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
        .map((p) => ({ value: String(p.id), label: p.name })),
    [peladas],
  );

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const pid = Number(peladaId);
    if (!peladaId || !Number.isFinite(pid)) {
      appToast.warning('Escolha a pelada em que você joga.');
      return;
    }
    setLoading(true);
    try {
      await registerPublicAccount({
        name: name.trim(),
        email: email.trim(),
        peladaId: pid,
      });
      appToast.success(
        'Conta criada. Faça login com a senha provisória 123456 (ou a configurada no servidor) e defina sua senha pessoal na sequência.',
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
          Crie sua conta como <strong>jogador</strong> na pelada em que você participa. A senha inicial é a padrão do
          sistema (como nas contas criadas pelo administrador); no primeiro acesso você será orientado a definir uma senha
          pessoal.
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
          <SearchableSelect
            id="reg-pelada"
            label={
              <>
                Pelada
                <span className={styles.requiredMark} aria-hidden>
                  *
                </span>
              </>
            }
            value={peladaId}
            onChange={(v) => setPeladaId(v)}
            options={peladaSelectOptions}
            emptyOption={{
              value: '',
              label: peladasFailed ? '— Erro ao carregar peladas —' : '— Selecione a pelada —',
            }}
            disabled={peladasFailed || peladas.length === 0}
            required
          />
          <button className={styles.submit} type="submit" disabled={loading || peladas.length === 0}>
            {loading ? 'Cadastrando…' : 'Criar conta'}
          </button>
          <p className={styles.subtitle} style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/login">Já tenho conta — entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
