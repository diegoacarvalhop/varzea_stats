import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import styles from './LoginPage.module.scss';

export function InactiveAccountPage() {
  const { logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={styles.root}>
      <div className={styles.bgGlow} aria-hidden />
      <div className={styles.fieldLines} aria-hidden />
      <div className={styles.card}>
        <p className={styles.badge}>Conta inativa</p>
        <h1 className={styles.title}>Acesso suspenso</h1>
        <p className={styles.subtitle}>
          Sua conta está marcada como inativa nas peladas. Você pode alterar a senha ou sair. Para voltar a participar,
          peça a um gestor que reative seu cadastro.
        </p>
        <p className={styles.subtitle}>
          <Link to="/alterar-senha">Alterar senha</Link>
        </p>
        <p className={styles.secondaryActionWrap}>
          <button type="button" className={styles.submitSecondary} onClick={() => logout()}>
            Sair
          </button>
        </p>
      </div>
    </div>
  );
}
