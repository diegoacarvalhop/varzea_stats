import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import { BOLA_VOTE_ROLES, hasAnyRole } from '@/lib/roles';
import { formatPlayerDirectoryLabel, listPlayersDirectory, type PlayerDirectoryEntry } from '@/services/playerService';
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
  const { roles } = useAuth();
  const canVoteBola = hasAnyRole(roles, BOLA_VOTE_ROLES);
  const location = useLocation();
  const [selectedMatchId, setSelectedMatchId] = useState('');
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
      const raw = playerId.trim();
      if (!raw) {
        appToast.warning('Escolha o jogador e a partida.');
        return;
      }
      const id = Number(raw);
      if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
        appToast.warning('Escolha uma partida válida na lista.');
        return;
      }
      const res = await submitVote(id, type);
      appToast.success(`Voto registrado (#${res.id}).`);
      setPlayerId('');
      setSelectedMatchId('');
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
  const matchOptions = useMemo(() => {
    const matches = new Map<number, string>();
    for (const entry of playerDirectory) {
      if (entry.matchId == null) continue;
      if (matches.has(entry.matchId)) continue;
      const when = entry.matchDate
        ? new Date(entry.matchDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : 'Sem data';
      const where = entry.matchLocation?.trim() ? entry.matchLocation.trim() : 'Sem local';
      matches.set(entry.matchId, `Partida #${entry.matchId} · ${when} · ${where}`);
    }
    return [...matches.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([matchId, label]) => ({ value: String(matchId), label }));
  }, [playerDirectory]);

  const playerMatchOptions = useMemo(() => {
    const matchId = Number(selectedMatchId);
    if (!Number.isFinite(matchId)) return [];
    return playerDirectory
      .filter((e) => e.matchId === matchId)
      .map((e) => ({
        value: String(e.playerId),
        label: formatPlayerDirectoryLabel(e),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [playerDirectory, selectedMatchId]);

  return (
    <div className={s.page}>
      <h1>Rankings</h1>
      <p className={s.lead}>
        <strong>Gols, assistências, cartões</strong> e demais lances: cada bloco ordena os jogadores pelo total
        registrado em todas as partidas (quem tem mais aparece em 1º). Abaixo, <strong>votação</strong> em bola cheia e
        bola murcha (só administrador geral, administrador ou jogador podem registrar voto).
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
        {!canVoteBola ? (
          <p className={s.lead}>
            Apenas perfis <strong>administrador geral</strong>, <strong>administrador</strong> ou{' '}
            <strong>jogador</strong> podem registrar votos de bola cheia ou bola murcha.
          </p>
        ) : (
          <>
            <p className={s.lead} style={{ marginBottom: '1rem' }}>
              Primeiro selecione a <strong>partida jogada</strong> e depois o <strong>jogador dessa partida</strong>. O voto de bola
              cheia ou murcha é sempre registrado para uma partida específica.
            </p>
            <form className={s.formInline} onSubmit={onSubmit}>
              <SearchableSelect
                id="rank-match-select"
                style={{ flex: '1 1 220px', maxWidth: 'min(100%, 420px)' }}
                label="Partida jogada"
                value={selectedMatchId}
                onChange={(value) => {
                  setSelectedMatchId(value);
                  setPlayerId('');
                }}
                options={matchOptions}
                emptyOption={{
                  value: '',
                  label: loading ? 'Carregando partidas…' : 'Selecione uma partida',
                }}
                disabled={loading}
                required
                formValueName="rankingVoteMatchId"
              />
              <SearchableSelect
                id="rank-player-select"
                style={{ flex: '1 1 320px', maxWidth: 'min(100%, 620px)' }}
                label="Jogador"
                value={playerId}
                onChange={setPlayerId}
                options={playerMatchOptions}
                emptyOption={{
                  value: '',
                  label: selectedMatchId ? 'Selecione o jogador' : 'Escolha a partida primeiro',
                }}
                disabled={loading || !selectedMatchId}
                required
                formValueName="rankingVotePlayerId"
              />
              <button className={s.btnVoteGood} type="submit">
                Bola cheia
              </button>
              <button className={s.btnVoteBad} type="button" onClick={() => void vote('BOLA_MURCHA')}>
                Bola murcha
              </button>
            </form>
            {!loading && matchOptions.length === 0 && (
              <p className={s.lead}>Nenhum jogador cadastrado ainda. Adicione jogadores no detalhe de uma partida.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
