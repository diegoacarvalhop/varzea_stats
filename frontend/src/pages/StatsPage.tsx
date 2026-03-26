import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { listPlayersDirectory, type PlayerDirectoryEntry } from '@/services/playerService';
import { listUsers, type UserSummary } from '@/services/userService';
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
  OWN_GOAL: 'Gols contra',
  ASSIST: 'Assistências',
  YELLOW_CARD: 'Cartões amarelos',
  RED_CARD: 'Cartões vermelhos',
  BLUE_CARD: 'Cartões azuis',
  FOUL: 'Faltas',
  PENALTY_PLAY: 'Pênaltis (durante jogo)',
  FOULS_SUFFERED: 'Faltas sofridas',
  OTHER: 'Outros',
  GOALS_CONCEDED: 'Gols sofridos (goleiro)',
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
  const { peladaId } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [trajectory, setTrajectory] = useState<PlayerTrajectory | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  const [playerDirectory, setPlayerDirectory] = useState<PlayerDirectoryEntry[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);

  const normalizeName = useCallback((v: string) => v.trim().toLocaleLowerCase('pt-BR'), []);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    try {
      const [dir, userList] = await Promise.all([listPlayersDirectory(), listUsers()]);
      setPlayerDirectory(dir);
      setUsers(userList);
    } catch {
      appToast.error('Não foi possível carregar a lista de jogadores.');
      setPlayerDirectory([]);
      setUsers([]);
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
    const uid = Number(selectedUserId);
    if (!selectedUserId || !Number.isFinite(uid)) {
      appToast.warning('Selecione um jogador na lista.');
      return;
    }
    const selected = users.find((u) => u.id === uid);
    if (!selected) {
      appToast.warning('Jogador inválido.');
      return;
    }
    const anchor = playerDirectory.find((p) => normalizeName(p.playerName) === normalizeName(selected.name));
    if (!anchor) {
      appToast.warning('Este jogador ainda não possui ficha em partida para análise.');
      return;
    }
    await loadPlayer(anchor.playerId);
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

  const registeredUsers = useMemo(() => {
    if (peladaId == null) return [];
    const filtered = users.filter(
      (u) => u.peladaId === peladaId || (Array.isArray(u.peladaIds) && u.peladaIds.includes(peladaId)),
    );
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return filtered;
  }, [users, peladaId]);

  const userSelectOptions = useMemo(
    () => registeredUsers.map((u) => ({ value: String(u.id), label: u.name })),
    [registeredUsers],
  );
  const forecastEventEstimates = useMemo(() => {
    const estimates = trajectory?.forecast.estimatedByEventNextMatch ?? {};
    const averages = trajectory?.forecast.averageByEventPerMatch ?? {};
    const order = [
      'GOAL',
      'OWN_GOAL',
      'ASSIST',
      'YELLOW_CARD',
      'RED_CARD',
      'BLUE_CARD',
      'FOUL',
      'PENALTY_PLAY',
      'FOULS_SUFFERED',
      'OTHER',
      'GOALS_CONCEDED',
    ];
    return order
      .filter((key) => estimates[key] != null || averages[key] != null)
      .map((key) => ({
        key,
        label: labelForEventKey(key),
        estimate: estimates[key] ?? 0,
        average: averages[key] ?? 0,
      }));
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
          Escolha na lista de jogadores cadastrados da pelada. A evolução agrupa pelo <strong>nome igual</strong> em
          várias partidas.
        </p>
        <form className={s.formInline} onSubmit={onSubmit}>
          <SearchableSelect
            id="stats-player-select"
            style={{ flex: '1 1 260px', maxWidth: 'min(100%, 520px)' }}
            label="Jogador"
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={userSelectOptions}
            disabled={playerLoading || directoryLoading}
            emptyOption={{
              value: '',
              label: directoryLoading ? 'Carregando jogadores…' : 'Selecione um jogador',
            }}
            required
          />
          <button className={s.btnPrimary} type="submit" disabled={playerLoading}>
            {playerLoading ? 'Consultando…' : 'Consultar'}
          </button>
        </form>
        {!directoryLoading && registeredUsers.length === 0 && (
          <p className={s.lead}>Nenhum jogador na base. Cadastre jogadores no detalhe de uma partida.</p>
        )}
        {stats && (
          <div className={s.statBlock}>
            <h3 className={s.statsDetailHeading}>
              {stats.playerName}
              {stats.goalkeeper && <span className={s.gkBadge}>Goleiro</span>}
            </h3>
            <p className={s.statsDetailMeta}>
              Indicadores numéricos agregados do jogador em todas as partidas da pelada.
            </p>
            <h4 className={s.statsDetailSub}>Lances (como jogador principal)</h4>
            <ul className={s.statList}>
              {Object.entries(stats.eventsByType).map(([k, v]) => (
                <li key={k} className={s.statRow}>
                  <span className={s.statKey}>{labelForEventKey(k)}</span>
                  <span className={s.statVal}>{v}</span>
                </li>
              ))}
              <li className={s.statRow}>
                <span className={s.statKey}>Gols sofridos (quando goleiro)</span>
                <span className={s.statVal}>{stats.goalsConceded}</span>
              </li>
              <li className={s.statRow}>
                <span className={s.statKey}>Faltas sofridas</span>
                <span className={s.statVal}>{stats.foulsSuffered}</span>
              </li>
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
                        <th>
                          <span className={s.colHintWrap}>
                            Data
                            <span className={s.colHintTooltip}>Data da partida</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            Local
                            <span className={s.colHintTooltip}>Local da partida</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            G
                            <span className={s.colHintTooltip}>Gols</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            GC
                            <span className={s.colHintTooltip}>Gols contra</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            A
                            <span className={s.colHintTooltip}>Assistências</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            GS
                            <span className={s.colHintTooltip}>Gols sofridos (goleiro)</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            Am.
                            <span className={s.colHintTooltip}>Cartões amarelos</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            Vm.
                            <span className={s.colHintTooltip}>Cartões vermelhos</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            Az.
                            <span className={s.colHintTooltip}>Cartões azuis</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            Ft.
                            <span className={s.colHintTooltip}>Faltas</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            Pên.
                            <span className={s.colHintTooltip}>Pênaltis</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            FS
                            <span className={s.colHintTooltip}>Faltas sofridas</span>
                          </span>
                        </th>
                        <th>
                          <span className={s.colHintWrap}>
                            Out.
                            <span className={s.colHintTooltip}>Outros lances</span>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trajectory.byMatch.map((m) => (
                        <tr key={m.matchId}>
                          <td>{formatMatchDate(m.matchDate)}</td>
                          <td>{m.matchLocation || '—'}</td>
                          <td>{m.goals}</td>
                          <td>{m.ownGoals}</td>
                          <td>{m.assists}</td>
                          <td>{m.goalsConceded}</td>
                          <td>{m.yellowCards}</td>
                          <td>{m.redCards}</td>
                          <td>{m.blueCards}</td>
                          <td>{m.fouls}</td>
                          <td>{m.penalties ?? 0}</td>
                          <td>{m.foulsSuffered}</td>
                          <td>{m.otherEvents}</td>
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
              {forecastEventEstimates.length > 0 && (
                <ul className={s.forecastEstimates}>
                  {forecastEventEstimates.map((item) => (
                    <li key={item.key}>
                      {item.label}: ~<strong>{item.estimate}</strong> (média <strong>{item.average}</strong>/partida)
                    </li>
                  ))}
                </ul>
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
