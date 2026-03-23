import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PlayerSelect } from '@/components/PlayerSelect';
import { appToast } from '@/lib/appToast';
import { listPlayersDirectory, type PlayerDirectoryEntry } from '@/services/playerService';
import {
  getLanceRankings,
  getVoteRanking,
  type LanceRankings,
  type VoteRanking,
} from '@/services/statsService';
import { submitVote, type VoteType } from '@/services/voteService';
import s from '@/styles/pageShared.module.scss';

type CountRow = { playerId: number; playerName: string; count: number };

function renderRankingRows(rows: CountRow[], empty: string) {
  if (!rows.length) return <p className={s.lead}>{empty}</p>;
  return (
    <ol className={s.rankingOrderedList}>
      {rows.map((row, idx) => (
        <li key={`${row.playerId}-${idx}`} className={s.rankingListItem}>
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
  '#ranking-votos': 'ranking-votos',
  '#ranking-classificacao': 'ranking-votos',
};

export function RankingPage() {
  const location = useLocation();
  const [playerId, setPlayerId] = useState('');

  const [voteRanking, setVoteRanking] = useState<VoteRanking | null>(null);
  const [lanceRankings, setLanceRankings] = useState<LanceRankings | null>(null);
  const [playerDirectory, setPlayerDirectory] = useState<PlayerDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRankings = useCallback(async () => {
    setLoading(true);
    try {
      const [votes, lances, directory] = await Promise.all([
        getVoteRanking(30),
        getLanceRankings(30),
        listPlayersDirectory(),
      ]);
      setVoteRanking(votes);
      setLanceRankings(lances);
      setPlayerDirectory(directory);
    } catch {
      appToast.error('Não foi possível carregar os rankings.');
      setVoteRanking(null);
      setLanceRankings(null);
      setPlayerDirectory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRankings();
  }, [loadRankings]);

  useEffect(() => {
    const sectionId = HASH_TO_SECTION[location.hash];
    if (!sectionId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, location.pathname]);

  async function vote(type: VoteType) {
    try {
      const id = Number(playerId);
      if (!Number.isFinite(id)) {
        appToast.warning('Escolha um jogador na lista.');
        return;
      }
      const res = await submitVote(id, type);
      appToast.success(`Voto registrado (#${res.id}).`);
      setPlayerId('');
      await loadRankings();
    } catch {
      appToast.error('Falha ao votar. Confira o jogador e tente de novo.');
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void vote('BOLA_CHEIA');
  }

  const bolaCheiaRows: CountRow[] =
    voteRanking?.bolaCheia?.map((e) => ({ playerId: e.playerId, playerName: e.playerName, count: e.voteCount })) ??
    [];
  const bolaMurchaRows: CountRow[] =
    voteRanking?.bolaMurcha?.map((e) => ({ playerId: e.playerId, playerName: e.playerName, count: e.voteCount })) ??
    [];

  return (
    <div className={s.page}>
      <h1>Rankings</h1>
      <p className={s.lead}>
        <strong>Gols, assistências, cartões</strong> e demais lances: cada bloco ordena os jogadores pelo total
        registrado em todas as partidas (quem tem mais aparece em 1º). Abaixo, <strong>votação</strong> da galera (bola
        cheia / murcha).
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
            {(lanceRankings?.blocks ?? []).map((block) => (
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

      <section className={s.card} style={{ marginTop: '1.25rem' }} id="ranking-votos" aria-labelledby="ranking-votos-title">
        <h2 className={s.cardTitle} id="ranking-votos-title">
          Classificação por votos
        </h2>
        {loading ? (
          <p className={s.lead}>Carregando votos…</p>
        ) : (
          <div className={s.rankingBoard}>
            <div className={s.rankingColumn}>
              <h3 className={s.rankingSubtitle}>Bola cheia</h3>
              <p className={s.rankingQtyCaption}>Votos</p>
              {renderRankingRows(bolaCheiaRows, 'Nenhum voto de bola cheia ainda.')}
            </div>
            <div className={s.rankingColumn}>
              <h3 className={s.rankingSubtitle}>Bola murcha</h3>
              <p className={s.rankingQtyCaption}>Votos</p>
              {renderRankingRows(bolaMurchaRows, 'Nenhum voto de bola murcha ainda.')}
            </div>
          </div>
        )}
      </section>

      <div className={s.card} style={{ marginTop: '1.25rem' }}>
        <h2 className={s.cardTitle}>Registrar voto</h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Escolha alguém que já foi incluído em alguma equipe em qualquer partida. O mesmo nome pode aparecer mais de
          uma vez se estiver em jogos diferentes — cada linha é um cadastro distinto.
        </p>
        <form className={s.formInline} onSubmit={onSubmit}>
          <PlayerSelect
            id="rank-player-select"
            label="Jogador"
            value={playerId}
            onChange={setPlayerId}
            entries={playerDirectory}
            loading={loading}
          />
          <button className={s.btnVoteGood} type="submit">
            Bola cheia
          </button>
          <button className={s.btnVoteBad} type="button" onClick={() => void vote('BOLA_MURCHA')}>
            Bola murcha
          </button>
        </form>
        {!loading && playerDirectory.length === 0 && (
          <p className={s.lead}>Nenhum jogador cadastrado ainda. Adicione jogadores no detalhe de uma partida.</p>
        )}
      </div>
    </div>
  );
}
