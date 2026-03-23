import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerSelect } from '@/components/PlayerSelect';
import { listPlayersDirectory, type PlayerDirectoryEntry } from '@/services/playerService';
import { appToast } from '@/lib/appToast';
import {
  getPlayerStats,
  getPlayerTrajectory,
  type PlayerStats,
  type PlayerTrajectory,
} from '@/services/statsService';
import s from '@/styles/pageShared.module.scss';

const EVENT_TYPE_LABELS: Record<string, string> = {
  GOAL: 'Gols',
  ASSIST: 'Assistências',
  YELLOW_CARD: 'Cartões amarelos',
  RED_CARD: 'Cartões vermelhos',
  BLUE_CARD: 'Cartões azuis',
  FOUL: 'Faltas',
  SUBSTITUTION: 'Substituições',
  OTHER: 'Outros',
};

function labelForEventKey(key: string): string {
  return EVENT_TYPE_LABELS[key] ?? key.replace(/_/g, ' ');
}

function formatMatchDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function StatsPage() {
  const [playerId, setPlayerId] = useState('');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [trajectory, setTrajectory] = useState<PlayerTrajectory | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  const [playerDirectory, setPlayerDirectory] = useState<PlayerDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    try {
      const dir = await listPlayersDirectory();
      setPlayerDirectory(dir);
    } catch {
      appToast.error('Não foi possível carregar a lista de jogadores.');
      setPlayerDirectory([]);
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const loadPlayer = useCallback(async (id: number) => {
    setPlayerLoading(true);
    setStats(null);
    setTrajectory(null);
    try {
      const [statsResult, trajectoryResult] = await Promise.allSettled([
        getPlayerStats(id),
        getPlayerTrajectory(id),
      ]);
      if (statsResult.status === 'rejected') {
        appToast.error('Jogador não encontrado ou erro na API.');
        return;
      }
      setStats(statsResult.value);
      setPlayerId(String(id));
      if (trajectoryResult.status === 'rejected') {
        appToast.warning(
          'Não foi possível carregar evolução e previsão. A ficha acima continua válida para este cadastro.',
        );
        return;
      }
      setTrajectory(trajectoryResult.value);
    } finally {
      setPlayerLoading(false);
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = Number(playerId);
    if (!playerId || !Number.isFinite(id)) {
      appToast.warning('Selecione um jogador na lista.');
      return;
    }
    await loadPlayer(id);
  }

  const maxGoalsInSeries = useMemo(() => {
    const list = trajectory?.byMatch ?? [];
    return Math.max(1, ...list.map((m) => m.goals));
  }, [trajectory]);

  const maxCumulativeGoals = useMemo(() => {
    const list = trajectory?.cumulativeByMatch ?? [];
    if (!list.length) return 1;
    return Math.max(1, ...list.map((p) => p.cumulativeGoals));
  }, [trajectory]);

  return (
    <div className={s.page}>
      <h1>Estatísticas</h1>
      <p className={s.lead}>
        Análise por <strong>jogador</strong>: ficha do cadastro na partida, <strong>evolução ao longo das peladas</strong>{' '}
        (todos os registros com o <strong>mesmo nome</strong>) e uma <strong>previsão informal</strong> para a próxima
        partida com base no ritmo recente. Classificações globais e votos ficam em{' '}
        <Link to="/ranking">Ranking</Link>.
      </p>

      <section className={s.card} aria-labelledby="stats-player-title">
        <h2 className={s.cardTitle} id="stats-player-title">
          Consultar jogador
        </h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Escolha na lista (quem já foi escalado em alguma partida). Cada combinação nome + partida + time é um cadastro
          separado; a evolução agrupa pelo <strong>nome igual</strong> em várias partidas.
        </p>
        <form className={s.formInline} onSubmit={onSubmit}>
          <PlayerSelect
            id="stats-player-select"
            label="Jogador"
            value={playerId}
            onChange={setPlayerId}
            entries={playerDirectory}
            loading={directoryLoading}
            disabled={playerLoading}
          />
          <button className={s.btnPrimary} type="submit" disabled={playerLoading}>
            {playerLoading ? 'Consultando…' : 'Consultar'}
          </button>
        </form>
        {!directoryLoading && playerDirectory.length === 0 && (
          <p className={s.lead}>Nenhum jogador na base. Cadastre jogadores no detalhe de uma partida.</p>
        )}
        {stats && (
          <div className={s.statBlock}>
            <h3 className={s.statsDetailHeading}>
              {stats.playerName}
              {stats.teamName && <span> — {stats.teamName}</span>}
              {stats.goalkeeper && <span className={s.gkBadge}>Goleiro</span>}
            </h3>
            <p className={s.statsDetailMeta}>
              Ficha deste cadastro na partida (referência interna #{stats.playerId}).
            </p>
            <h4 className={s.statsDetailSub}>Lances (como jogador principal)</h4>
            <ul className={s.statList}>
              {Object.entries(stats.eventsByType).map(([k, v]) => (
                <li key={k} className={s.statRow}>
                  <span className={s.statKey}>{labelForEventKey(k)}</span>
                  <span className={s.statVal}>{v}</span>
                </li>
              ))}
            </ul>
            <h4 className={s.statsDetailSub}>Votos recebidos</h4>
            <div className={s.voteRow}>
              <p>
                Bola cheia: <strong>{stats.bolaCheiaVotes}</strong>
              </p>
              <p>
                Bola murcha: <strong>{stats.bolaMurchaVotes}</strong>
              </p>
            </div>
          </div>
        )}

        {trajectory && (
          <>
            <h3 className={s.statsDetailSub} style={{ marginTop: '1.5rem' }}>
              Evolução — «{trajectory.groupedByPlayerName}»
            </h3>
            <p className={s.statsDetailMeta}>
              {trajectory.matchesWithEvents} partida(s) com lance atribuído a esse nome (cadastros diferentes com o mesmo
              apelido entram juntos — veja o aviso metodológico abaixo).
            </p>

            {trajectory.byMatch.length > 0 && (
              <>
                <h4 className={s.statsDetailSub}>Gols por partida</h4>
                <div className={s.trajectoryBars} role="img" aria-label="Barras de gols por partida">
                  {trajectory.byMatch.map((m) => (
                    <div key={m.matchId} className={s.trajectoryBarRow}>
                      <span className={s.trajectoryBarLabel} title={m.matchLocation || undefined}>
                        {formatMatchDate(m.matchDate)}
                      </span>
                      <div className={s.trajectoryBarTrack}>
                        <div
                          className={s.trajectoryBarFill}
                          style={{ width: `${(m.goals / maxGoalsInSeries) * 100}%` }}
                        />
                      </div>
                      <span className={s.trajectoryBarVal}>{m.goals}</span>
                    </div>
                  ))}
                </div>

                <h4 className={s.statsDetailSub}>Gols acumulados</h4>
                <div className={s.trajectoryCumulative} role="img" aria-label="Evolução cumulativa de gols">
                  {trajectory.cumulativeByMatch.map((p) => (
                    <div key={p.matchId} className={s.trajectoryCumCol}>
                      <div
                        className={s.trajectoryCumBar}
                        style={{ height: `${(p.cumulativeGoals / maxCumulativeGoals) * 100}%` }}
                        title={`${p.cumulativeGoals} gols até esta partida`}
                      />
                      <span className={s.trajectoryCumLabel}>{formatMatchDate(p.matchDate)}</span>
                    </div>
                  ))}
                </div>

                <h4 className={s.statsDetailSub}>Por partida (detalhe)</h4>
                <div className={s.trajectoryTableWrap}>
                  <table className={s.trajectoryTable}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Local</th>
                        <th>G</th>
                        <th>A</th>
                        <th>Am.</th>
                        <th>Vm.</th>
                        <th>Az.</th>
                        <th>Ft.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trajectory.byMatch.map((m) => (
                        <tr key={m.matchId}>
                          <td>{formatMatchDate(m.matchDate)}</td>
                          <td>{m.matchLocation || '—'}</td>
                          <td>{m.goals}</td>
                          <td>{m.assists}</td>
                          <td>{m.yellowCards}</td>
                          <td>{m.redCards}</td>
                          <td>{m.blueCards}</td>
                          <td>{m.fouls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className={s.forecastCard}>
              <h4 className={s.forecastTitle}>Previsão informal (próxima partida)</h4>
              <p className={s.forecastTrend}>
                Tendência de gols: <strong>{trajectory.forecast.goalsTrendLabel}</strong>
              </p>
              {(trajectory.forecast.estimatedGoalsNextMatch != null ||
                trajectory.forecast.estimatedAssistsNextMatch != null) && (
                <ul className={s.forecastEstimates}>
                  {trajectory.forecast.estimatedGoalsNextMatch != null && (
                    <li>
                      ~<strong>{trajectory.forecast.estimatedGoalsNextMatch}</strong> gol(s) (referência pelo ritmo
                      recente)
                    </li>
                  )}
                  {trajectory.forecast.estimatedAssistsNextMatch != null && (
                    <li>
                      ~<strong>{trajectory.forecast.estimatedAssistsNextMatch}</strong> assistência(s)
                    </li>
                  )}
                </ul>
              )}
              {(trajectory.forecast.averageGoalsPerMatch != null ||
                trajectory.forecast.averageAssistsPerMatch != null) && (
                <p className={s.forecastAverages}>
                  {trajectory.forecast.averageGoalsPerMatch != null && (
                    <>
                      Média gols/partida: <strong>{trajectory.forecast.averageGoalsPerMatch}</strong>
                    </>
                  )}
                  {trajectory.forecast.averageGoalsPerMatch != null &&
                    trajectory.forecast.averageAssistsPerMatch != null &&
                    ' · '}
                  {trajectory.forecast.averageAssistsPerMatch != null && (
                    <>
                      assistências: <strong>{trajectory.forecast.averageAssistsPerMatch}</strong>
                    </>
                  )}
                </p>
              )}
              <p className={s.forecastNarrative}>{trajectory.forecast.narrative}</p>
              <p className={s.methodologyNote}>{trajectory.forecast.methodologyNote}</p>
            </div>
          </>
        )}
      </section>

      <p className={s.lead} style={{ marginTop: '1.25rem' }}>
        <Link to="/ranking">Abrir ranking global e votar →</Link>
      </p>
    </div>
  );
}
