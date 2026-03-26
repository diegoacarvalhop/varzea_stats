import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createEventForMatch,
  listEventsByMatch,
  type EventType,
  type MatchEvent,
} from '@/services/eventService';
import { listMediaForMatch, type MatchMediaItem } from '@/services/mediaService';
import { finishMatch, formatMatchPlacar, getMatch, type Match, type TeamScore } from '@/services/matchService';
import {
  listPlayersByMatch,
  type Player,
} from '@/services/playerService';
import { listPeladas, type Pelada } from '@/services/peladaService';
import { listTeamsByMatch, type Team } from '@/services/teamService';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MatchMediaGallery } from '@/components/MatchMediaGallery';
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import {
  EVENT_RECORDER_ROLES,
  hasAnyRole,
  MATCH_MANAGER_ROLES,
} from '@/lib/roles';
import s from '@/styles/pageShared.module.scss';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'GOAL', label: 'Gol' },
  { value: 'OWN_GOAL', label: 'Gol contra' },
  { value: 'ASSIST', label: 'Assistência' },
  { value: 'YELLOW_CARD', label: 'Cartão amarelo' },
  { value: 'RED_CARD', label: 'Cartão vermelho' },
  { value: 'BLUE_CARD', label: 'Cartão azul' },
  { value: 'FOUL', label: 'Falta' },
  { value: 'PENALTY', label: 'Pênalti' },
  { value: 'OTHER', label: 'Outro' },
];

const EVENT_LABELS: Record<EventType, string> = Object.fromEntries(
  EVENT_TYPES.map((x) => [x.value, x.label]),
) as Record<EventType, string>;

function buildPlayerOptionsByTeam(list: Player[], teams: Team[]): SearchableSelectOption[] {
  const knownIds = new Set(teams.map((t) => t.id));
  const byTeam = new Map<number, Player[]>();
  for (const t of teams) byTeam.set(t.id, []);
  const orphans: Player[] = [];
  for (const p of list) {
    if (p.teamId != null && knownIds.has(p.teamId)) {
      byTeam.get(p.teamId)!.push(p);
    } else {
      orphans.push(p);
    }
  }
  const out: SearchableSelectOption[] = [];
  for (const team of teams) {
    const ps = (byTeam.get(team.id) ?? []).slice().sort((a, b) => {
      if (a.goalkeeper !== b.goalkeeper) return a.goalkeeper ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    for (const p of ps) {
      out.push({
        value: String(p.id),
        label: `${p.name}${p.goalkeeper ? ' — Goleiro' : ''}`,
        group: team.name,
      });
    }
  }
  if (orphans.length > 0) {
    const ps = orphans.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    for (const p of ps) {
      out.push({
        value: String(p.id),
        label: `${p.name}${p.goalkeeper ? ' — Goleiro' : ''}`,
        group: 'Sem equipe nesta partida',
      });
    }
  }
  return out;
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MatchDetailPage() {
  const { matchId: matchIdParam } = useParams<{ matchId: string }>();
  const matchId = Number(matchIdParam);
  const navigate = useNavigate();
  const { isAuthenticated, roles } = useAuth();
  const canRecord = isAuthenticated && hasAnyRole(roles, EVENT_RECORDER_ROLES);
  const canFinish = isAuthenticated && hasAnyRole(roles, MATCH_MANAGER_ROLES);

  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [mediaItems, setMediaItems] = useState<MatchMediaItem[]>([]);

  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [peladaForMatch, setPeladaForMatch] = useState<Pelada | null | undefined>(undefined);
  const [startingTeamA, setStartingTeamA] = useState('');
  const [startingTeamB, setStartingTeamB] = useState('');

  const [eventType, setEventType] = useState<EventType>('GOAL');
  const [eventPlayerId, setEventPlayerId] = useState('');
  const [eventTargetId, setEventTargetId] = useState('');
  const [penaltyPlayerId, setPenaltyPlayerId] = useState('');
  const [penaltyTargetId, setPenaltyTargetId] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [extraMinutesInput, setExtraMinutesInput] = useState('0');

  const matchFinished = Boolean(match?.finishedAt);
  const configuredDurationMinutes = peladaForMatch?.matchDurationMinutes ?? 0;
  const timerConfigured = configuredDurationMinutes > 0;
  const timerEnded = timerConfigured && countdownSeconds === 0;
  const teamsByName = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.name, t);
    return map;
  }, [teams]);

  const activeTeams = useMemo(() => {
    const out: Team[] = [];
    if (startingTeamA) {
      const a = teamsByName.get(startingTeamA);
      if (a) out.push(a);
    }
    if (startingTeamB && startingTeamB !== startingTeamA) {
      const b = teamsByName.get(startingTeamB);
      if (b) out.push(b);
    }
    return out;
  }, [startingTeamA, startingTeamB, teamsByName]);

  const selectedPairValid = activeTeams.length === 2;

  const activeTeamIds = useMemo(() => new Set(activeTeams.map((t) => t.id)), [activeTeams]);

  const activePlayers = useMemo(() => {
    if (activeTeams.length === 0) return [];
    return players.filter((p) => p.teamId != null && activeTeamIds.has(p.teamId));
  }, [players, activeTeamIds, activeTeams.length]);

  const selectedPlacar = useMemo(() => {
    if (!match?.teamScores || match.teamScores.length === 0) return '';
    if (!selectedPairValid) return '';
    const scoreByName = new Map<string, TeamScore>();
    for (const s of match.teamScores) scoreByName.set(s.teamName, s);
    const filtered = activeTeams
      .map((t) => scoreByName.get(t.name))
      .filter((s): s is TeamScore => s != null);
    if (filtered.length === 0) return '';
    return formatMatchPlacar(filtered);
  }, [match?.teamScores, activeTeams, selectedPairValid]);

  const selectedTeamsStorageKey = useMemo(() => {
    if (!Number.isFinite(matchId)) return '';
    return `match:selected-teams:${matchId}`;
  }, [matchId]);

  const eventMainPlayer = useMemo(() => {
    if (!eventPlayerId) return null;
    const id = Number(eventPlayerId);
    if (!Number.isFinite(id)) return null;
    return activePlayers.find((p) => p.id === id) ?? null;
  }, [eventPlayerId, activePlayers]);

  const targetPlayerOptions = useMemo(() => {
    if (!eventMainPlayer) return activePlayers;
    return activePlayers.filter((p) => p.teamId !== eventMainPlayer.teamId);
  }, [eventMainPlayer, activePlayers]);

  const penaltyMainPlayer = useMemo(() => {
    if (!penaltyPlayerId) return null;
    const id = Number(penaltyPlayerId);
    if (!Number.isFinite(id)) return null;
    return activePlayers.find((p) => p.id === id) ?? null;
  }, [penaltyPlayerId, activePlayers]);

  const penaltyTargetOptions = useMemo(() => {
    if (!penaltyMainPlayer) return activePlayers;
    return activePlayers.filter((p) => p.teamId !== penaltyMainPlayer.teamId);
  }, [penaltyMainPlayer, activePlayers]);

  useEffect(() => {
    if (!eventTargetId) return;
    const tid = Number(eventTargetId);
    if (!Number.isFinite(tid)) return;
    const ok = targetPlayerOptions.some((p) => p.id === tid);
    if (!ok) setEventTargetId('');
  }, [eventTargetId, targetPlayerOptions]);

  useEffect(() => {
    if (!penaltyTargetId) return;
    const tid = Number(penaltyTargetId);
    if (!Number.isFinite(tid)) return;
    const ok = penaltyTargetOptions.some((p) => p.id === tid);
    if (!ok) setPenaltyTargetId('');
  }, [penaltyTargetId, penaltyTargetOptions]);

  useEffect(() => {
    if (!eventPlayerId) return;
    const pid = Number(eventPlayerId);
    if (!Number.isFinite(pid)) return;
    if (!activePlayers.some((p) => p.id === pid)) {
      setEventPlayerId('');
      setEventTargetId('');
    }
  }, [eventPlayerId, activePlayers]);

  useEffect(() => {
    if (!penaltyPlayerId) return;
    const pid = Number(penaltyPlayerId);
    if (!Number.isFinite(pid)) return;
    if (!activePlayers.some((p) => p.id === pid)) {
      setPenaltyPlayerId('');
      setPenaltyTargetId('');
    }
  }, [penaltyPlayerId, activePlayers]);

  const eventTypeSelectOptions = useMemo(
    () => EVENT_TYPES.map((x) => ({ value: x.value, label: x.label })),
    [],
  );

  const eventPlayerSelectOptions = useMemo(
    () => buildPlayerOptionsByTeam(activePlayers, activeTeams),
    [activePlayers, activeTeams],
  );

  const targetPlayerSelectOptions = useMemo(
    () => buildPlayerOptionsByTeam(targetPlayerOptions, activeTeams),
    [targetPlayerOptions, activeTeams],
  );

  const penaltyTargetSelectOptions = useMemo(
    () => buildPlayerOptionsByTeam(penaltyTargetOptions, activeTeams),
    [penaltyTargetOptions, activeTeams],
  );

  const refresh = useCallback(async () => {
    if (!Number.isFinite(matchId)) return;
    const [m, t, p, e] = await Promise.all([
      getMatch(matchId),
      listTeamsByMatch(matchId),
      listPlayersByMatch(matchId),
      listEventsByMatch(matchId),
    ]);
    setMatch(m);
    setTeams(t);
    setPlayers(p);
    setEvents(e);
    if (m?.peladaId != null) {
      try {
        const list = await listPeladas();
        setPeladaForMatch(list.find((x) => x.id === m.peladaId) ?? null);
      } catch {
        setPeladaForMatch(null);
      }
    } else {
      setPeladaForMatch(null);
    }
    try {
      const media = await listMediaForMatch(matchId);
      setMediaItems(media);
    } catch {
      setMediaItems([]);
    }
  }, [matchId]);

  useEffect(() => {
    if (!Number.isFinite(matchId)) {
      appToast.error('Partida inválida.');
      return;
    }
    void refresh().catch(() => appToast.error('Não foi possível carregar a partida.'));
  }, [matchId, refresh]);

  useEffect(() => {
    if (!selectedTeamsStorageKey) return;
    try {
      const raw = window.localStorage.getItem(selectedTeamsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { teamA?: string; teamB?: string };
      if (typeof parsed.teamA === 'string') setStartingTeamA(parsed.teamA);
      if (typeof parsed.teamB === 'string') setStartingTeamB(parsed.teamB);
    } catch {
      // no-op
    }
  }, [selectedTeamsStorageKey]);

  useEffect(() => {
    if (startingTeamA && !teams.some((t) => t.name === startingTeamA)) setStartingTeamA('');
    if (startingTeamB && !teams.some((t) => t.name === startingTeamB)) setStartingTeamB('');
  }, [teams, startingTeamA, startingTeamB]);

  useEffect(() => {
    if (!selectedTeamsStorageKey) return;
    try {
      window.localStorage.setItem(
        selectedTeamsStorageKey,
        JSON.stringify({ teamA: startingTeamA, teamB: startingTeamB }),
      );
    } catch {
      // no-op
    }
  }, [selectedTeamsStorageKey, startingTeamA, startingTeamB]);

  useEffect(() => {
    if (!timerConfigured) {
      setCountdownRunning(false);
      setCountdownSeconds(0);
      return;
    }
    setCountdownRunning(false);
    setCountdownSeconds(configuredDurationMinutes * 60);
    setExtraMinutesInput('0');
  }, [configuredDurationMinutes, timerConfigured, match?.id]);

  useEffect(() => {
    if (!countdownRunning || countdownSeconds <= 0) return;
    const tid = window.setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          setCountdownRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tid);
  }, [countdownRunning, countdownSeconds]);

  function rosterSlicesForTeam(teamId: number) {
    const teamPlayers = players.filter((p) => p.teamId === teamId);
    const firstFieldIdx = teamPlayers.findIndex((p) => !p.goalkeeper);
    const goalkeepers = firstFieldIdx === -1 ? teamPlayers : teamPlayers.slice(0, firstFieldIdx);
    const fieldPlayers = firstFieldIdx === -1 ? [] : teamPlayers.slice(firstFieldIdx);
    return { goalkeepers, fieldPlayers };
  }

  async function onCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (!selectedPairValid) {
      appToast.warning('Selecione os 2 times desta partida antes de registrar lances.');
      return;
    }
    if (activeTeams.length === 0) {
      appToast.warning('Não há equipes selecionadas para esta partida.');
      return;
    }
    if (activePlayers.length === 0) {
      appToast.warning('Cadastre jogadores nas equipes antes de registrar lances.');
      return;
    }
    if ((eventType === 'GOAL' || eventType === 'ASSIST') && !eventPlayerId) {
      appToast.warning('Selecione o jogador principal para registrar gol ou assistência.');
      return;
    }
    if (eventType === 'FOUL' && eventTargetId && !eventPlayerId) {
      appToast.warning('Para indicar quem sofreu a falta, selecione antes o infrator.');
      return;
    }
    try {
      const pid = eventPlayerId ? Number(eventPlayerId) : null;
      const tid = eventTargetId ? Number(eventTargetId) : null;
      await createEventForMatch(matchId, {
        type: eventType,
        playerId: pid,
        targetId: tid,
      });
      setEventPlayerId('');
      setEventTargetId('');
      appToast.success('Lance registrado.');
      await refresh();
    } catch {
      appToast.error('Falha ao registrar lance. Verifique jogadores e permissões.');
    }
  }

  async function onRegisterPenalty(e: FormEvent) {
    e.preventDefault();
    if (!selectedPairValid) {
      appToast.warning('Selecione os 2 times desta partida antes de registrar pênaltis.');
      return;
    }
    if (activeTeams.length === 0) {
      appToast.warning('Não há equipes selecionadas para esta partida.');
      return;
    }
    if (activePlayers.length === 0) {
      appToast.warning('Cadastre jogadores nas equipes antes de registrar pênaltis.');
      return;
    }
    if (!penaltyPlayerId) {
      appToast.warning('Selecione o cobrador do pênalti.');
      return;
    }
    try {
      await createEventForMatch(matchId, {
        type: 'PENALTY',
        playerId: Number(penaltyPlayerId),
        targetId: penaltyTargetId ? Number(penaltyTargetId) : null,
      });
      setPenaltyPlayerId('');
      setPenaltyTargetId('');
      appToast.success('Pênalti registrado.');
      await refresh();
    } catch {
      appToast.error('Falha ao registrar pênalti.');
    }
  }

  async function executeFinishMatch() {
    setFinishConfirmOpen(false);
    setFinishing(true);
    try {
      await finishMatch(matchId);
      appToast.success('Partida finalizada.');
      navigate('/matches#nova-partida');
    } catch {
      appToast.error('Falha ao finalizar partida.');
    } finally {
      setFinishing(false);
    }
  }

  function applyExtraTime() {
    const mins = Number(extraMinutesInput);
    if (!Number.isFinite(mins) || mins <= 0) {
      appToast.warning('Informe minutos de acréscimo válidos.');
      return;
    }
    const secondsToAdd = Math.floor(mins * 60);
    setCountdownSeconds((prev) => prev + secondsToAdd);
    appToast.success(`Acréscimo aplicado: +${mins} min.`);
  }

  function eventLine(ev: MatchEvent) {
    const typeLabel = EVENT_LABELS[ev.type] ?? ev.type;
    const main =
      ev.playerId != null
        ? (players.find((p) => p.id === ev.playerId)?.name ?? 'Jogador removido')
        : '—';
    const tgt =
      ev.targetId != null
        ? (players.find((p) => p.id === ev.targetId)?.name ?? 'Jogador removido')
        : null;
    return (
      <span>
        <strong>{typeLabel}</strong>
        {main !== '—' && <> · {main}</>}
        {tgt && <> → {tgt}</>}
      </span>
    );
  }

  const penalties = useMemo(() => events.filter((ev) => ev.type === 'PENALTY'), [events]);
  const nonPenaltyEvents = useMemo(() => events.filter((ev) => ev.type !== 'PENALTY'), [events]);

  if (!Number.isFinite(matchId)) {
    return (
      <div className={s.page}>
        <p className={s.lead}>Não foi possível abrir esta partida.</p>
        <Link to="/matches">Voltar às partidas</Link>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/matches">← Voltar às partidas</Link>
      </p>

      {match && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem 1rem' }}>
            <h1 style={{ margin: 0 }}>Partida #{match.id}</h1>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.55rem',
                borderRadius: 10,
                border: `1px solid ${timerEnded ? 'rgba(255,82,82,0.6)' : 'rgba(105,240,174,0.35)'}`,
                background: timerEnded ? 'rgba(255,82,82,0.12)' : 'rgba(0,0,0,0.22)',
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  color: timerEnded ? '#ff8a80' : 'rgba(230,255,240,0.95)',
                }}
              >
                {timerConfigured ? formatCountdown(countdownSeconds) : '--:--'}
              </span>
              <button
                type="button"
                className={s.btnPrimary}
                onClick={() => setCountdownRunning((v) => !v)}
                disabled={!timerConfigured}
              >
                {countdownRunning ? 'Pausar' : 'Iniciar'}
              </button>
              <input
                className={s.input}
                style={{ width: '5.5rem' }}
                type="number"
                min={1}
                step={1}
                value={extraMinutesInput}
                onChange={(ev) => setExtraMinutesInput(ev.target.value)}
                aria-label="Minutos de acréscimo"
                placeholder="Acréscimo"
              />
              <button type="button" className={s.btn} onClick={applyExtraTime} disabled={!timerConfigured}>
                Acréscimos
              </button>
            </div>
          </div>
          {!timerConfigured && (
            <p className={s.statsDetailMeta} style={{ marginTop: '0.45rem' }}>
              Defina a duração da partida nas configurações da pelada para habilitar o cronômetro.
            </p>
          )}
          <p className={s.lead}>
            {new Date(match.date).toLocaleString('pt-BR')} · {match.location}
          </p>
          <p className={s.statsDetailMeta} style={{ marginTop: '-0.15rem' }}>
            {selectedPairValid
              ? `${startingTeamA} x ${startingTeamB}`
              : 'Selecione os 2 times desta partida na seção de equipes.'}
          </p>
          {selectedPlacar && <p className={s.placarHighlight}>{selectedPlacar}</p>}
        </>
      )}

      {matchFinished && match?.finishedAt && (
        <p className={s.finishedBanner}>
          Partida encerrada em {new Date(match.finishedAt).toLocaleString('pt-BR')}. Resultado registrado:{' '}
          <strong>{selectedPlacar || '—'}</strong>. Escalação e novos lances estão bloqueados.
        </p>
      )}

      {match && mediaItems.length > 0 && <MatchMediaGallery items={mediaItems} />}

      <div className={s.card}>
        <h2 className={s.cardTitle}>1. Equipes desta partida</h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Os times já vêm da preparação de pré-jogo na tela de Partidas. Aqui você apenas acompanha os elencos.
        </p>

        {teams.length === 0 && <p className={s.lead}>Nenhuma equipe ainda.</p>}

        {teams.length >= 2 && (
          <div className={s.formInline} style={{ marginBottom: '0.5rem' }}>
            <div className={s.field} style={{ flex: '1 1 220px' }}>
              <label className={s.fieldLabel}>Time 1 (início)</label>
              <select
                className={`${s.input} ${s.select}`}
                value={startingTeamA}
                onChange={(ev) => setStartingTeamA(ev.target.value)}
              >
                <option value="">Selecione…</option>
                {teams.map((team) => (
                  <option key={`a-${team.id}`} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={s.field} style={{ flex: '1 1 220px' }}>
              <label className={s.fieldLabel}>Time 2 (início)</label>
              <select
                className={`${s.input} ${s.select}`}
                value={startingTeamB}
                onChange={(ev) => setStartingTeamB(ev.target.value)}
              >
                <option value="">Selecione…</option>
                {teams.map((team) => (
                  <option key={`b-${team.id}`} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {teams.length >= 2 && !selectedPairValid && (
          <p className={s.statsDetailMeta} style={{ marginBottom: '1rem' }}>
            Selecione 2 times diferentes para iniciar esta partida.
          </p>
        )}

        <div className={s.teamGrid} style={{ gridTemplateColumns: 'repeat(2, minmax(18rem, 1fr))' }}>
          {activeTeams.map((team) => (
            <div key={team.id} className={s.teamCard}>
              <h3 className={s.teamTitle}>{team.name}</h3>
              {(() => {
                const { goalkeepers, fieldPlayers } = rosterSlicesForTeam(team.id);
                const row = (p: Player) => (
                  <li key={p.id} className={s.rosterRow}>
                    <span className={s.rosterName}>
                      {p.name}
                      {p.goalkeeper && <span className={s.gkBadge}>Goleiro</span>}
                    </span>
                  </li>
                );
                if (goalkeepers.length === 0 && fieldPlayers.length === 0) {
                  return <p className={s.lead}>Nenhum jogador.</p>;
                }
                return (
                  <div className={s.rosterBlock}>
                    {goalkeepers.length > 0 && (
                      <ul className={s.rosterList}>{goalkeepers.map(row)}</ul>
                    )}
                    {goalkeepers.length > 0 && fieldPlayers.length > 0 && (
                      <div className={s.rosterDivider} role="separator" />
                    )}
                    {fieldPlayers.length > 0 && (
                      <ul className={s.rosterList}>{fieldPlayers.map(row)}</ul>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>

      </div>

      <div className={s.card}>
        <h2 className={s.cardTitle}>2. Pênaltis da partida</h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Sessão específica para marcação de pênaltis. Use esta seção somente quando a partida terminar empatada.
        </p>
        {matchFinished ? (
          <p className={s.lead}>Não é possível registrar pênaltis nesta partida encerrada.</p>
        ) : canRecord ? (
          <form className={s.form} onSubmit={onRegisterPenalty}>
            <SearchableSelect
              id="penalty-player"
              label={
                <>
                  Cobrador
                  <span className={s.requiredMark} aria-hidden>
                    *
                  </span>
                </>
              }
              value={penaltyPlayerId}
              onChange={setPenaltyPlayerId}
              options={eventPlayerSelectOptions}
              required
              emptyOption={{ value: '', label: '— Selecione o cobrador —' }}
            />
            <SearchableSelect
              id="penalty-target"
              label="Goleiro/alvo (time adversário)"
              value={penaltyTargetId}
              onChange={setPenaltyTargetId}
              options={penaltyTargetSelectOptions}
              disabled={!penaltyMainPlayer}
              emptyOption={{
                value: '',
                label: !penaltyMainPlayer ? '— Selecione o cobrador primeiro —' : '— Nenhum —',
              }}
            />
            <button className={s.btnPrimary} type="submit">
              Registrar pênalti
            </button>
          </form>
        ) : (
          <p className={s.lead}>Entre como administrador, SCOUT ou MEDIA para registrar pênaltis.</p>
        )}
        <h3 className={s.cardTitle} style={{ marginTop: '1.25rem' }}>
          Histórico de pênaltis
        </h3>
        {penalties.length === 0 ? (
          <p className={s.lead}>Nenhum pênalti registrado ainda.</p>
        ) : (
          <ul className={s.timeline}>
            {penalties.map((ev) => (
              <li key={ev.id} className={s.timelineItem}>
                <span className={s.timelineId}>#{ev.id}</span>
                {eventLine(ev)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={s.card}>
        <h2 className={s.cardTitle}>3. Lances (stats) desta partida</h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Registre o que acontece no jogo; as estatísticas por jogador usam estes eventos.
        </p>
        {matchFinished ? (
          <p className={s.lead}>Não é possível registrar novos lances nesta partida encerrada.</p>
        ) : canRecord ? (
          <form className={s.form} onSubmit={onCreateEvent}>
            <SearchableSelect
              id="ev-type"
              label={
                <>
                  Tipo de lance
                  <span className={s.requiredMark} aria-hidden>
                    *
                  </span>
                </>
              }
              value={eventType}
              onChange={(v) => setEventType(v as EventType)}
              options={eventTypeSelectOptions}
              required
            />
            <SearchableSelect
              id="ev-player"
              label={
                <>
                  {eventType === 'FOUL' ? 'Infrator (quem cometeu a falta)' : 'Jogador principal'}
                  {(eventType === 'GOAL' || eventType === 'ASSIST') && (
                    <span className={s.requiredMark} aria-hidden title="Obrigatório para gol e assistência">
                      *
                    </span>
                  )}
                  {eventType !== 'GOAL' && eventType !== 'ASSIST' && ' (opcional)'}
                </>
              }
              value={eventPlayerId}
              onChange={setEventPlayerId}
              options={eventPlayerSelectOptions}
              emptyOption={{ value: '', label: '— Nenhum —' }}
            />
            <SearchableSelect
              id="ev-target"
              label="Jogador alvo (time adversário ao jogador principal)"
              value={eventTargetId}
              onChange={setEventTargetId}
              options={targetPlayerSelectOptions}
              disabled={!eventMainPlayer}
              emptyOption={{
                value: '',
                label: !eventMainPlayer ? '— Selecione o jogador principal primeiro —' : '— Nenhum —',
              }}
            />
            <button className={s.btnPrimary} type="submit">
              Registrar lance
            </button>
          </form>
        ) : (
          <p className={s.lead}>Entre como administrador, SCOUT ou MEDIA para registrar lances.</p>
        )}

        <h3 className={s.cardTitle} style={{ marginTop: '1.5rem' }}>
          Histórico (mais recentes primeiro)
        </h3>
        {nonPenaltyEvents.length === 0 ? (
          <p className={s.lead}>Nenhum lance registrado ainda.</p>
        ) : (
          <ul className={s.timeline}>
            {nonPenaltyEvents.map((ev) => (
              <li key={ev.id} className={s.timelineItem}>
                <span className={s.timelineId}>#{ev.id}</span>
                {eventLine(ev)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={s.card}>
        <h2 className={s.cardTitle}>4. Encerrar partida</h2>
        <p className={s.lead}>
          Quando o jogo acabar, finalize aqui. Você será levado à tela de <strong>nova partida</strong> para começar o
          próximo cadastro.
        </p>
        {canFinish && !matchFinished && (
          <button
            type="button"
            className={s.btnPrimary}
            onClick={() => setFinishConfirmOpen(true)}
            disabled={finishing}
          >
            {finishing ? 'Finalizando…' : 'Finalizar partida e voltar'}
          </button>
        )}
        {matchFinished && (
          <p className={s.lead}>
            <Link to="/matches#nova-partida">Ir para cadastrar nova partida</Link>
          </p>
        )}
        {!canFinish && !matchFinished && (
          <p className={s.lead}>
            Faça login como <strong>administrador</strong>, <strong>SCOUT</strong> ou <strong>MEDIA</strong> para encerrar a
            partida.
          </p>
        )}
      </div>

      <ConfirmModal
        open={finishConfirmOpen}
        title="Finalizar partida"
        message="O placar (gols por equipe) será registrado com base nos lances já cadastrados. A escalação e os lances não poderão mais ser alterados. Em seguida você irá para o cadastro de uma nova partida."
        confirmLabel="Finalizar"
        cancelLabel="Cancelar"
        onCancel={() => setFinishConfirmOpen(false)}
        onConfirm={() => void executeFinishMatch()}
      />
    </div>
  );
}
