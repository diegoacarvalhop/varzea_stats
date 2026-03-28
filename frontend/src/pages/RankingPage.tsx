import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { appToast } from '@/lib/appToast';
import {
  fetchRankingPageBundle,
  type LanceRankings,
} from '@/services/statsService';
import s from '@/styles/pageShared.module.scss';

type CountRow = { playerId: number; playerName: string; count: number };

function renderRankingRows(rows: CountRow[], empty: string) {
  if (!rows.length) return <p className={s.lead}>{empty}</p>;
  return (
    <ol className={s.rankingOrderedList}>
      {rows.map((row, idx) => (
        <li key={`${row.playerName}-${idx}`} className={s.rankingListItem}>
          <span className={s.rankingPos}>{idx + 1}º</span>
          <span className={s.rankingName}>{row.playerName}</span>
          <span className={s.rankingQty}>{row.count}</span>
        </li>
      ))}
    </ol>
  );
}

const HASH_TO_SECTION: Record<string, string> = {
  '#ranking-lances': 'ranking-lances',
};

export function RankingPage() {
  const location = useLocation();
  const [lanceRankings, setLanceRankings] = useState<LanceRankings | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRankingsGenRef = useRef(0);
  const loadRankings = useCallback(async () => {
    const gen = ++loadRankingsGenRef.current;
    setLoading(true);
    try {
      const bundle = await fetchRankingPageBundle();
      if (gen !== loadRankingsGenRef.current) return;
      setLanceRankings(bundle.lanceRankings);
      if (bundle.failed.length > 0) {
        appToast.error(`Não foi possível carregar: ${bundle.failed.join(', ')}.`);
      }
    } finally {
      if (gen === loadRankingsGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadRankings();
  }, [loadRankings, location.pathname]);

  useEffect(() => {
    const sectionId = HASH_TO_SECTION[location.hash];
    if (!sectionId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, location.pathname]);

  const blocks = useMemo(() => lanceRankings?.blocks ?? [], [lanceRankings]);

  return (
    <div className={s.page}>
      <h1>Rankings</h1>
      <p className={s.lead}>
        <strong>Gols, assistências, cartões</strong> e demais lances: cada bloco ordena os jogadores pelo total
        registrado em todas as partidas (quem tem mais aparece em 1º).
      </p>

      <section className={s.card} id="ranking-lances" aria-labelledby="ranking-lances-title">
        <h2 className={s.cardTitle} id="ranking-lances-title">
          Ranking por tipo de lance
        </h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Contagem por jogador principal do lance. Ex.: em <strong>Gols</strong>, só entram eventos marcados como gol com
          jogador associado.
        </p>
        {loading ? (
          <p className={s.lead}>Carregando rankings de lances…</p>
        ) : (
          <div className={s.rankingLancesGrid}>
            {blocks.map((block) => (
              <div key={block.eventType} className={s.rankingLanceBlock}>
                <h3 className={s.rankingSubtitle}>{block.label}</h3>
                <p className={s.rankingQtyCaption}>Quantidade</p>
                {renderRankingRows(
                  block.entries.map((e) => ({
                    playerId: e.playerId,
                    playerName: e.playerName,
                    count: e.eventCount,
                  })),
                  'Ninguém na tabela ainda.',
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
