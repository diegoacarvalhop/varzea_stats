import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getPeladaId } from '@/lib/peladaContext';
import { isAdminGeral } from '@/lib/roles';
import { appToast } from '@/lib/appToast';
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

export function ChangePasswordPage() {
  const { changePassword, isAuthenticated, mustChangePassword, logout } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Nova senha · VARzea Stats';
    return () => {
      document.title = 'VARzea Stats';
    };
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!mustChangePassword) {
    const raw = localStorage.getItem('varzea_user');
    const roles = parseStoredRoles(raw);
    if (isAdminGeral(roles) && !getPeladaId()) {
      return <Navigate to="/pelada" replace />;
    }
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 6) {
      appToast.warning('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      appToast.warning('A confirmação não coincide com a nova senha.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(senhaAtual, novaSenha);
      appToast.success('Senha atualizada. Bem-vindo!');
    } catch {
      appToast.error('Não foi possível alterar. Verifique a senha atual.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bgGlow} aria-hidden />
      <div className={styles.fieldLines} aria-hidden />
      <div className={styles.card}>
        <p className={styles.badge}>Primeiro acesso</p>
        <h1 className={styles.title}>Definir nova senha</h1>
        <p className={styles.subtitle}>
          Sua conta foi criada com a senha padrão. Escolha uma senha pessoal para continuar usando o sistema.
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <PasswordField
            id="cp-atual"
            label="Senha atual (padrão)"
            value={senhaAtual}
            onChange={setSenhaAtual}
            autoComplete="current-password"
            required
          />
          <PasswordField
            id="cp-nova"
            label="Nova senha"
            value={novaSenha}
            onChange={setNovaSenha}
            autoComplete="new-password"
            required
            minLength={6}
            showStrengthMeter
          />
          <PasswordField
            id="cp-conf"
            label="Confirmar nova senha"
            value={confirmar}
            onChange={setConfirmar}
            autoComplete="new-password"
            required
            minLength={6}
          />
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar e continuar'}
          </button>
          <p className={styles.secondaryActionWrap}>
            <button type="button" className={styles.submitSecondary} onClick={() => logout()}>
              Sair
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
