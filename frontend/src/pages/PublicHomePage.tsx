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
        <p className={styles.badge}>Peladas ativas</p>
        <h1 className={styles.title}>VARzea Stats</h1>
        <p className={styles.subtitle}>
          Acompanhe partidas e estatísticas.{' '}
          <Link to="/login">Entrar</Link>
          {' · '}
          <Link to="/cadastro">Cadastrar</Link>
        </p>
        {loading ? (
          <p className={styles.subtitle}>Carregando…</p>
        ) : cards.length === 0 ? (
          <p className={styles.subtitle}>Nenhuma pelada ativa no momento.</p>
        ) : (
          <ul className={grid.cardGrid}>
            {cards.map((c) => (
              <li key={c.id} className={grid.peladaCard}>
                <h2 className={grid.cardTitle}>{c.name}</h2>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
