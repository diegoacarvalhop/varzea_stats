import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appToast } from '@/lib/appToast';
import { getPublicPeladaCards, type PeladaPublicCard } from '@/services/peladaService';
import styles from './LoginPage.module.scss';
import grid from './PublicHomePage.module.scss';

export function PublicHomePage() {
  const [cards, setCards] = useState<PeladaPublicCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPublicPeladaCards();
      setCards(list);
    } catch {
      appToast.error('Não foi possível carregar as peladas.');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'VARzea Stats';
    void load();
  }, [load]);

  return (
    <div className={styles.root}>
      <div className={styles.bgGlow} aria-hidden />
      <div className={styles.fieldLines} aria-hidden />
      <div className={`${styles.card} ${grid.wideCard}`}>
        <p className={`${styles.badge} ${grid.centerText}`}>Bem-vindo</p>
        <h1 className={`${styles.title} ${grid.centerText}`}>VARzea Stats</h1>
        <p className={`${styles.subtitle} ${grid.centerText}`}>Crie e acompanhe partidas e estatísticas da sua pelada.</p>
        <div className={grid.actionsRow}>
          <Link to="/login" className={grid.actionBtn}>
            Entrar
          </Link>
          <Link to="/cadastro?tipo=admin" className={grid.actionBtnSecondary}>
            Criar nova pelada (ADMIN)
          </Link>
        </div>
        {loading ? (
          <p className={`${styles.subtitle} ${grid.centerText}`}>Carregando…</p>
        ) : cards.length === 0 ? (
          <p className={`${styles.subtitle} ${grid.centerText}`}>Nenhuma pelada ativa no momento.</p>
        ) : (
          <>
            <h2 className={grid.activeTitle}>Peladas ativas</h2>
            <ul className={grid.cardGrid}>
              {cards.map((c) => (
                <li key={c.id} className={grid.peladaCard}>
                  <h3 className={grid.cardTitle}>{c.name}</h3>
                  <dl className={grid.cardMeta}>
                    <div>
                      <dt>Jogadores</dt>
                      <dd>{c.playerCount}</dd>
                    </div>
                    <div>
                      <dt>Local</dt>
                      <dd>{c.location?.trim() || '—'}</dd>
                    </div>
                    <div>
                      <dt>Horário</dt>
                      <dd>{c.scheduleLabel?.trim() || '—'}</dd>
                    </div>
                  </dl>
                  <div style={{ marginTop: '0.75rem' }}>
                    <Link to={`/cadastro?peladaId=${c.id}`} className={grid.actionBtnSecondary}>
                      Entrar nesta pelada (cadastro de jogador)
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
