import {
  type CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createEventForMatch,
  deleteEventForMatch,
  listEventsByMatch,
  type EventType,
  type MatchEvent,
} from '@/services/eventService';
import { listMediaForMatch, type MatchMediaItem } from '@/services/mediaService';
import {
  finishMatch,
  formatMatchPlacar,
  formatMatchPlacarFromFocus,
  getMatch,
  updateMatchFocusTeams,
  type Match,
  type TeamScore,
} from '@/services/matchService';
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
import { getApiErrorMessage } from '@/lib/apiError';
import { appToast } from '@/lib/appToast';
import {
  EVENT_RECORDER_ROLES,
  hasAnyRole,
  MATCH_MANAGER_ROLES,
} from '@/lib/roles';
import { formatSecondsAsHms } from '@/lib/durationTime';
import s from '@/styles/pageShared.module.scss';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'GOAL', label: 'Gol' },
  { value: 'PENALTY_PLAY', label: 'Pênalti (durante jogo)' },
  { value: 'OWN_GOAL', label: 'Gol contra' },
  { value: 'ASSIST', label: 'Assistência' },
  { value: 'YELLOW_CARD', label: 'Cartão amarelo' },
  { value: 'RED_CARD', label: 'Cartão vermelho' },
  { value: 'BLUE_CARD', label: 'Cartão azul' },
  { value: 'FOUL', label: 'Falta' },
  { value: 'OTHER', label: 'Outro' },
];

const EVENT_LABELS: Record<EventType, string> = Object.fromEntries(
  EVENT_TYPES.map((x) => [x.value, x.label]),
) as Record<EventType, string>;

const TIMER_ICON_SIZE = 20;

function IconPlay() {
  return (
    <svg width={TIMER_ICON_SIZE} height={TIMER_ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconSquare() {
  return (
    <svg width={TIMER_ICON_SIZE} height={TIMER_ICON_SIZE} viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width={TIMER_ICON_SIZE} height={TIMER_ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 7v6l4 2" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width={TIMER_ICON_SIZE} height={TIMER_ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg width={TIMER_ICON_SIZE} height={TIMER_ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12a9 9 0 1 0 2.64-6.36M3 4v4h4"
      />
    </svg>
  );
}

const timerIconButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '2.4rem',
  minHeight: '2.4rem',
  padding: '0.35rem',
};

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
  return formatSecondsAsHms(seconds);
}

type PersistedMatchTimer = {
  remainingSeconds: number;
  running: boolean;
  savedAtMs: number;
  completed?: boolean;
  /** Total do período no cronômetro (inicial + acréscimos), para calcular tempo decorrido. */
  totalPeriodSeconds?: number;
};

function resolveTimerFromStorage(raw: string | null): PersistedMatchTimer | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      remainingSeconds?: number;
      running?: boolean;
      savedAtMs?: number;
      completed?: boolean;
    };
    if (!Number.isFinite(parsed.remainingSeconds) || !Number.isFinite(parsed.savedAtMs)) return null;
    const remaining = Math.max(0, Math.floor(parsed.remainingSeconds!));
    const savedAtMs = Math.floor(parsed.savedAtMs!);
    if (parsed.running) {
      const elapsed = Math.max(0, Math.floor((Date.now() - savedAtMs) / 1000));
      const nextRemaining = Math.max(0, remaining - elapsed);
      return {
        remainingSeconds: nextRemaining,
        running: nextRemaining > 0,
        savedAtMs: Date.now(),
        completed: parsed.completed === true || nextRemaining === 0,
      };
    }
    if (remaining === 0 && parsed.completed !== true) {
      return null;
    }
    return { remainingSeconds: remaining, running: false, savedAtMs, completed: parsed.completed === true };
  } catch {
    return null;
  }
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
  const [deleteEventConfirmOpen, setDeleteEventConfirmOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const deleteEventInFlightRef = useRef(false);
  const [peladaForMatch, setPeladaForMatch] = useState<Pelada | null | undefined>(undefined);
  const [startingTeamA, setStartingTeamA] = useState('');
  const [startingTeamB, setStartingTeamB] = useState('');
  const [selectedTeamsHydrated, setSelectedTeamsHydrated] = useState(false);

  const [eventType, setEventType] = useState<EventType>('GOAL');
  const [eventPlayerId, setEventPlayerId] = useState('');
  const [eventTargetId, setEventTargetId] = useState('');
  const [penaltyPlayerId, setPenaltyPlayerId] = useState('');
  const [penaltyTargetId, setPenaltyTargetId] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  /** Total do período (regulamento + acréscimos), em segundos — usado para tempo decorrido = total - restante. */
  const [totalPeriodSeconds, setTotalPeriodSeconds] = useState(0);
  const [extraMinutesInput, setExtraMinutesInput] = useState('0');
  const [timerHydrated, setTimerHydrated] = useState(false);

  const matchFinished = Boolean(match?.finishedAt);
  const matchCancelled = Boolean(match?.cancelledAt);
  const matchEnded = matchFinished || matchCancelled;
  const focusPairReady =
    match != null &&
    match.focusTeamAId != null &&
    match.focusTeamBId != null &&
    match.focusTeamAId !== match.focusTeamBId;
  const canDeleteEvents = canRecord && !matchEnded;
  const configuredDurationSeconds = peladaForMatch?.matchDurationSeconds ?? 0;
  const timerConfigured = configuredDurationSeconds > 0;
  const timerEnded = timerConfigured && countdownSeconds === 0;
  const timerControlsEnabled = timerConfigured && focusPairReady && !matchEnded;
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

  const headerPlacar = useMemo(() => {
    if (!match?.teamScores || match.teamScores.length === 0) return '';
    const fromApi = formatMatchPlacarFromFocus(match);
    if (fromApi) return fromApi;
    if (!selectedPairValid) return '';
    const scoreByName = new Map<string, TeamScore>();
    for (const s of match.teamScores) scoreByName.set(s.teamName, s);
    const filtered = activeTeams
      .map((t) => scoreByName.get(t.name))
      .filter((s): s is TeamScore => s != null);
    if (filtered.length === 0) return '';
    return formatMatchPlacar(filtered);
  }, [match, activeTeams, selectedPairValid]);

  const selectedTeamsStorageKey = useMemo(() => {
    if (!Number.isFinite(matchId)) return '';
    return `match:selected-teams:${matchId}`;
  }, [matchId]);

  const timerStorageKey = useMemo(() => {
    if (!Number.isFinite(matchId)) return '';
    return `match:timer:${matchId}`;
  }, [matchId]);

  const eventMainPlayer = useMemo(() => {
    if (!eventPlayerId) return null;
    const id = Number(eventPlayerId);
    if (!Number.isFinite(id)) return null;
    return activePlayers.find((p) => p.id === id) ?? null;
  }, [eventPlayerId, activePlayers]);

  const targetPlayerOptions = useMemo(() => {
    if (!eventMainPlayer) return activePlayers;
    const opponents = activePlayers.filter((p) => p.teamId !== eventMainPlayer.teamId);
    const sameTeam = activePlayers.filter((p) => p.teamId === eventMainPlayer.teamId);
    if (eventType === 'PENALTY_PLAY') {
      // Pênalti durante o jogo precisa selecionar o goleiro adversário para contar como gols sofridos.
      return opponents.filter((p) => p.goalkeeper);
    }
    if (eventType === 'GOAL') {
      // Para o gol, o “alvo” do registro é o goleiro adversário.
      return opponents.filter((p) => p.goalkeeper);
    }
    if (eventType === 'OWN_GOAL') {
      // Para o gol contra, o “alvo” do registro é o goleiro da própria equipe.
      return sameTeam.filter((p) => p.goalkeeper && p.id !== eventMainPlayer.id);
    }
    return opponents;
  }, [eventMainPlayer, activePlayers, eventType]);

  /** Gol contra: o alvo é sempre o goleiro da própria equipe (gol “sofrido” por ele); não pedimos escolha manual. */
  const ownGoalAutoTargetPlayer = useMemo(() => {
    if (eventType !== 'OWN_GOAL' || !eventMainPlayer) return null;
    const gks = activePlayers.filter(
      (p) => p.teamId === eventMainPlayer.teamId && p.goalkeeper && p.id !== eventMainPlayer.id,
    );
    if (gks.length === 0) return null;
    const sorted = [...gks].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return sorted[0];
  }, [eventType, eventMainPlayer, activePlayers]);

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
    if (eventType !== 'OWN_GOAL') return;
    if (ownGoalAutoTargetPlayer) {
      setEventTargetId(String(ownGoalAutoTargetPlayer.id));
    } else {
      setEventTargetId('');
    }
  }, [eventType, ownGoalAutoTargetPlayer]);

  useEffect(() => {
    const acceptsTarget =
      eventType === 'FOUL' ||
      eventType === 'SUBSTITUTION' ||
      eventType === 'GOAL' ||
      eventType === 'OWN_GOAL' ||
      eventType === 'PENALTY_PLAY';
    if (!acceptsTarget && eventTargetId) {
      setEventTargetId('');
    }
  }, [eventType, eventTargetId]);

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
    if (!selectedTeamsStorageKey || teams.length === 0) return;
    const m = match;
    if (
      m != null &&
      m.focusTeamAId != null &&
      m.focusTeamBId != null &&
      m.focusTeamAId !== m.focusTeamBId
    ) {
      const ta = teams.find((t) => t.id === m.focusTeamAId);
      const tb = teams.find((t) => t.id === m.focusTeamBId);
      if (ta && tb) {
        setStartingTeamA(ta.name);
        setStartingTeamB(tb.name);
        setSelectedTeamsHydrated(true);
        return;
      }
    }
    try {
      const raw = window.localStorage.getItem(selectedTeamsStorageKey);
      if (!raw) {
        setSelectedTeamsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as { teamA?: string; teamB?: string };
      if (typeof parsed.teamA === 'string') setStartingTeamA(parsed.teamA);
      if (typeof parsed.teamB === 'string') setStartingTeamB(parsed.teamB);
    } catch {
      // no-op
    } finally {
      setSelectedTeamsHydrated(true);
    }
  }, [selectedTeamsStorageKey, teams, match?.focusTeamAId, match?.focusTeamBId, match?.id]);

  useEffect(() => {
    if (teams.length === 0) return;
    if (startingTeamA && !teams.some((t) => t.name === startingTeamA)) setStartingTeamA('');
    if (startingTeamB && !teams.some((t) => t.name === startingTeamB)) setStartingTeamB('');
  }, [teams, startingTeamA, startingTeamB]);

  useEffect(() => {
    if (!selectedTeamsStorageKey) return;
    if (!selectedTeamsHydrated) return;
    try {
      window.localStorage.setItem(
        selectedTeamsStorageKey,
        JSON.stringify({ teamA: startingTeamA, teamB: startingTeamB }),
      );
    } catch {
      // no-op
    }
  }, [selectedTeamsStorageKey, selectedTeamsHydrated, startingTeamA, startingTeamB]);

  async function persistFocusPair(nameA: string, nameB: string) {
    if (!Number.isFinite(matchId) || teams.length < 2) return;
    const ta = teams.find((t) => t.name === nameA);
    const tb = teams.find((t) => t.name === nameB);
    if (!ta || !tb || ta.id === tb.id) return;
    try {
      const updated = await updateMatchFocusTeams(matchId, { teamAId: ta.id, teamBId: tb.id });
      setMatch(updated);
    } catch {
      appToast.error('Não foi possível salvar o confronto no servidor.');
    }
  }

  useEffect(() => {
    if (!timerStorageKey) return;
    if (peladaForMatch === undefined) return;
    if (!timerConfigured) {
      setCountdownRunning(false);
      setCountdownSeconds(0);
      setTotalPeriodSeconds(0);
      setTimerHydrated(true);
      return;
    }
    const rawStr = window.localStorage.getItem(timerStorageKey);
    const restored = resolveTimerFromStorage(rawStr);
    const initialPeriod = configuredDurationSeconds;
    if (restored) {
      setCountdownSeconds(restored.remainingSeconds);
      setCountdownRunning(restored.running);
      let total = initialPeriod;
      try {
        const raw = JSON.parse(rawStr || '{}') as { totalPeriodSeconds?: number };
        if (
          typeof raw.totalPeriodSeconds === 'number' &&
          Number.isFinite(raw.totalPeriodSeconds) &&
          raw.totalPeriodSeconds >= restored.remainingSeconds
        ) {
          total = Math.floor(raw.totalPeriodSeconds);
        } else {
          total = Math.max(initialPeriod, restored.remainingSeconds);
        }
      } catch {
        total = Math.max(initialPeriod, restored.remainingSeconds);
      }
      setTotalPeriodSeconds(total);
    } else {
      setCountdownRunning(false);
      setCountdownSeconds(initialPeriod);
      setTotalPeriodSeconds(initialPeriod);
    }
    setExtraMinutesInput('0');
    setTimerHydrated(true);
  }, [timerStorageKey, timerConfigured, configuredDurationSeconds, peladaForMatch]);

  useEffect(() => {
    if (!timerStorageKey || !timerHydrated) return;
    if (peladaForMatch === undefined) return;
    try {
      const payload: PersistedMatchTimer = {
        remainingSeconds: Math.max(0, Math.floor(countdownSeconds)),
        running: countdownRunning && countdownSeconds > 0,
        savedAtMs: Date.now(),
        completed: timerConfigured && !countdownRunning && countdownSeconds === 0,
        totalPeriodSeconds: Math.max(0, Math.floor(totalPeriodSeconds)),
      };
      window.localStorage.setItem(timerStorageKey, JSON.stringify(payload));
    } catch {
      // no-op
    }
  }, [timerStorageKey, timerHydrated, countdownSeconds, countdownRunning, totalPeriodSeconds, peladaForMatch]);

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
    if (
      (eventType === 'GOAL' || eventType === 'ASSIST' || eventType === 'PENALTY_PLAY' || eventType === 'OWN_GOAL') &&
      !eventPlayerId
    ) {
      appToast.warning(
        eventType === 'OWN_GOAL'
          ? 'Selecione o jogador que fez o gol contra.'
          : 'Selecione o jogador principal para registrar este lance.',
      );
      return;
    }
    if ((eventType === 'GOAL' || eventType === 'PENALTY_PLAY') && !eventTargetId) {
      appToast.warning('Selecione o goleiro adversário para este lance.');
      return;
    }
    if (eventType === 'OWN_GOAL' && !ownGoalAutoTargetPlayer) {
      appToast.warning(
        'Gol contra exige um goleiro da mesma equipe na escalação (além de quem fez o gol contra). Ajuste os jogadores.',
      );
      return;
    }
    if (eventType === 'FOUL' && eventTargetId && !eventPlayerId) {
      appToast.warning('Para indicar quem sofreu a falta, selecione antes o infrator.');
      return;
    }
    try {
      const pid = eventPlayerId ? Number(eventPlayerId) : null;
      const acceptsTarget =
        eventType === 'FOUL' ||
        eventType === 'SUBSTITUTION' ||
        eventType === 'GOAL' ||
        eventType === 'OWN_GOAL' ||
        eventType === 'PENALTY_PLAY';
      let tid: number | null = null;
      if (acceptsTarget) {
        if (eventType === 'OWN_GOAL') {
          tid = ownGoalAutoTargetPlayer!.id;
        } else if (eventTargetId) {
          tid = Number(eventTargetId);
        }
      }
      await createEventForMatch(matchId, {
        type: eventType,
        playerId: pid,
        targetId: tid,
        clockElapsedSeconds: clockElapsedSecondsNow(),
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
    if (!penaltyTargetId) {
      appToast.warning('Selecione o goleiro/alvo do pênalti.');
      return;
    }
    try {
      await createEventForMatch(matchId, {
        type: 'PENALTY',
        playerId: Number(penaltyPlayerId),
        targetId: Number(penaltyTargetId),
        clockElapsedSeconds: clockElapsedSecondsNow(),
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
      if (timerStorageKey) {
        try {
          window.localStorage.removeItem(timerStorageKey);
        } catch {
          // no-op
        }
      }
      if (selectedTeamsStorageKey) {
        try {
          window.localStorage.removeItem(selectedTeamsStorageKey);
        } catch {
          // no-op
        }
      }
      appToast.success('Partida finalizada.');
      navigate('/matches#nova-partida');
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Falha ao finalizar partida.'));
    } finally {
      setFinishing(false);
    }
  }

  async function executeDeleteEvent() {
    if (deleteEventId == null || deleteEventInFlightRef.current) return;
    deleteEventInFlightRef.current = true;
    setDeletingEvent(true);
    try {
      await deleteEventForMatch(matchId, deleteEventId);
      appToast.success('Lance excluído.');
      setDeleteEventConfirmOpen(false);
      setDeleteEventId(null);
      await refresh();
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível excluir o lance.'));
    } finally {
      deleteEventInFlightRef.current = false;
      setDeletingEvent(false);
    }
  }

  function applyExtraTime() {
    const mins = Number(extraMinutesInput);
    if (!Number.isFinite(mins) || mins <= 0) {
      appToast.warning('Informe minutos de acréscimo válidos.');
      return;
    }
    const secondsToAdd = Math.floor(mins * 60);
    setTotalPeriodSeconds((prev) => prev + secondsToAdd);
    setCountdownSeconds((prev) => prev + secondsToAdd);
    appToast.success(`Acréscimo aplicado: +${mins} min.`);
  }

  /** Volta ao tempo inicial da pelada (duração configurada), sem acréscimos, e pausa o cronômetro. */
  function resetTimerToInitial() {
    if (!timerConfigured) return;
    const initial = configuredDurationSeconds;
    setCountdownSeconds(initial);
    setTotalPeriodSeconds(initial);
    setCountdownRunning(false);
    setExtraMinutesInput('0');
    appToast.success('Cronômetro zerado (tempo inicial da pelada).');
  }

  /** Tempo já decorrido no cronômetro (crescente), em segundos, para gravar no lance. */
  function clockElapsedSecondsNow(): number | null {
    if (!timerConfigured || totalPeriodSeconds <= 0) return null;
    return Math.max(0, Math.floor(totalPeriodSeconds - countdownSeconds));
  }

  function eventLine(ev: MatchEvent) {
    const typeLabel = EVENT_LABELS[ev.type] ?? ev.type;
    const mainPlayer = ev.playerId != null ? players.find((p) => p.id === ev.playerId) ?? null : null;
    const main =
      ev.playerId != null ? (mainPlayer?.name ?? 'Jogador removido') : '—';
    const mainTeamName = mainPlayer?.teamName ?? null;
    const tgt =
      ev.targetId != null
        ? (players.find((p) => p.id === ev.targetId)?.name ?? 'Jogador removido')
        : null;
    const clockPrefix =
      ev.clockElapsedSeconds != null && ev.clockElapsedSeconds >= 0 ? (
        <>
          <strong>{formatCountdown(ev.clockElapsedSeconds)}</strong>
          {' · '}
        </>
      ) : null;
    return (
      <span>
        {clockPrefix}
        <strong>{typeLabel}</strong>
        {main !== '—' && (
          <>
            {' '}
            · {main}
            {ev.type === 'OWN_GOAL' && mainTeamName ? ` (${mainTeamName})` : ''}
          </>
        )}
        {tgt && <> → {tgt}</>}
      </span>
    );
  }

  const penalties = useMemo(() => events.filter((ev) => ev.type === 'PENALTY'), [events]);
  const nonPenaltyEvents = useMemo(() => events.filter((ev) => ev.type !== 'PENALTY'), [events]);
  /** Maior id = último lance registrado na partida (pênaltis e stats no mesmo fluxo). */
  const lastEventId = useMemo(() => {
    if (events.length === 0) return null;
    return Math.max(...events.map((e) => e.id));
  }, [events]);

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
            {!matchEnded && (
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
                  style={timerIconButtonStyle}
                  onClick={() => setCountdownRunning((v) => !v)}
                  disabled={!timerControlsEnabled}
                  aria-label={countdownRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
                  title={
                    !focusPairReady
                      ? 'Selecione os dois times do confronto na seção Equipes abaixo.'
                      : countdownRunning
                        ? 'Pausar'
                        : 'Iniciar'
                  }
                >
                  {countdownRunning ? <IconSquare /> : <IconPlay />}
                </button>
                <button
                  type="button"
                  className={s.btn}
                  style={timerIconButtonStyle}
                  onClick={resetTimerToInitial}
                  disabled={!timerControlsEnabled}
                  aria-label="Zerar cronômetro"
                  title="Volta ao tempo inicial da pelada (sem acréscimos) e pausa o cronômetro."
                >
                  <IconReset />
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
                  disabled={!timerControlsEnabled}
                />
                <button
                  type="button"
                  className={s.btn}
                  style={{ ...timerIconButtonStyle, gap: 1 }}
                  onClick={applyExtraTime}
                  disabled={!timerControlsEnabled}
                  aria-label="Aplicar acréscimos"
                  title="Aplicar minutos de acréscimo"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <IconClock />
                    <IconPlus />
                  </span>
                </button>
              </div>
            )}
          </div>
          {!matchEnded && !timerConfigured && (
            <p className={s.statsDetailMeta} style={{ marginTop: '0.45rem' }}>
              Defina a duração da partida nas configurações da pelada para habilitar o cronômetro.
            </p>
          )}
          {!matchEnded && timerConfigured && !focusPairReady && (
            <p className={s.statsDetailMeta} style={{ marginTop: '0.45rem' }}>
              Selecione os <strong>dois times do confronto</strong> na seção &quot;Equipes desta partida&quot; abaixo para
              liberar o cronômetro e o encerramento.
            </p>
          )}
          <p className={s.lead}>
            {new Date(match.date).toLocaleString('pt-BR')} · {match.location}
          </p>
          {matchCancelled ? (
            <p className={s.lead} style={{ marginTop: '0.35rem' }}>
              <strong>Cancelada</strong>
              {match.cancelledAt ? ` em ${new Date(match.cancelledAt).toLocaleString('pt-BR')}` : ''}.
            </p>
          ) : matchFinished ? (
            headerPlacar ? <p className={s.placarHighlight}>{headerPlacar}</p> : null
          ) : (
            <>
              <p className={s.statsDetailMeta} style={{ marginTop: '-0.15rem' }}>
                {selectedPairValid
                  ? `${startingTeamA} x ${startingTeamB}`
                  : 'Selecione os 2 times desta partida na seção de equipes.'}
              </p>
              {headerPlacar ? <p className={s.placarHighlight}>{headerPlacar}</p> : null}
            </>
          )}
        </>
      )}

      {matchFinished && match?.finishedAt && (
        <p className={s.finishedBanner}>
          Partida encerrada em {new Date(match.finishedAt).toLocaleString('pt-BR')}. Resultado registrado:{' '}
          <strong>{headerPlacar || '—'}</strong>. Escalação e novos lances estão bloqueados.
        </p>
      )}

      {match && mediaItems.length > 0 && <MatchMediaGallery items={mediaItems} />}

      <div className={s.card}>
        <h2 className={s.cardTitle}>1. Equipes desta partida</h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Os times já vêm da preparação de pré-jogo na tela de Partidas. Aqui você apenas acompanha os elencos.
        </p>

        {teams.length === 0 && <p className={s.lead}>Nenhuma equipe ainda.</p>}

        {teams.length >= 2 && !matchEnded && (
          <div className={s.formInline} style={{ marginBottom: '0.5rem' }}>
            <div className={s.field} style={{ flex: '1 1 220px' }}>
              <label className={s.fieldLabel}>Time 1 (início)</label>
              <select
                className={`${s.input} ${s.select}`}
                value={startingTeamA}
                onChange={(ev) => {
                  const v = ev.target.value;
                  setStartingTeamA(v);
                  void persistFocusPair(v, startingTeamB);
                }}
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
                onChange={(ev) => {
                  const v = ev.target.value;
                  setStartingTeamB(v);
                  void persistFocusPair(startingTeamA, v);
                }}
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
        {teams.length >= 2 && !selectedPairValid && !matchEnded && (
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
        {matchEnded ? (
          <p className={s.lead}>Não é possível registrar pênaltis nesta partida encerrada ou cancelada.</p>
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
                <span style={{ flex: '1 1 12rem', minWidth: 0 }}>{eventLine(ev)}</span>
                {canDeleteEvents && lastEventId !== null && ev.id === lastEventId && (
                  <button
                    type="button"
                    className={s.btnRemove}
                    onClick={() => {
                      setDeleteEventId(ev.id);
                      setDeleteEventConfirmOpen(true);
                    }}
                  >
                    Excluir
                  </button>
                )}
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
        {matchEnded ? (
          <p className={s.lead}>Não é possível registrar novos lances nesta partida encerrada ou cancelada.</p>
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
                  {eventType === 'FOUL'
                    ? 'Infrator (quem cometeu a falta)'
                    : eventType === 'OWN_GOAL'
                      ? 'Quem fez o gol contra'
                      : 'Jogador principal'}
                  {(eventType === 'GOAL' ||
                    eventType === 'ASSIST' ||
                    eventType === 'PENALTY_PLAY' ||
                    eventType === 'OWN_GOAL') && (
                    <span className={s.requiredMark} aria-hidden title="Obrigatório para este tipo de lance">
                      *
                    </span>
                  )}
                  {eventType !== 'GOAL' &&
                    eventType !== 'ASSIST' &&
                    eventType !== 'PENALTY_PLAY' &&
                    eventType !== 'OWN_GOAL' &&
                    ' (opcional)'}
                </>
              }
              value={eventPlayerId}
              onChange={setEventPlayerId}
              options={eventPlayerSelectOptions}
              emptyOption={{ value: '', label: '— Nenhum —' }}
            />
            {eventType === 'OWN_GOAL' && eventMainPlayer?.teamName ? (
              <p className={s.statsDetailMeta} style={{ margin: '-0.35rem 0 0.75rem' }}>
                Time que fez gol contra: <strong>{eventMainPlayer.teamName}</strong>
              </p>
            ) : null}
            {eventType === 'OWN_GOAL' ? (
              <div className={s.field}>
                <span className={s.fieldLabel}>Goleiro da própria equipe (gol sofrido — automático)</span>
                <p className={s.statsDetailMeta} style={{ margin: 0 }}>
                  {ownGoalAutoTargetPlayer ? (
                    <>
                      <strong>{ownGoalAutoTargetPlayer.name}</strong> — contabilizado automaticamente; não é o goleiro
                      adversário.
                    </>
                  ) : eventMainPlayer ? (
                    <>
                      Cadastre outro goleiro na mesma equipe (além de quem fez o contra) para registrar o gol sofrido.
                    </>
                  ) : (
                    <>Escolha acima quem fez o gol contra; o goleiro alvo será o da mesma equipe.</>
                  )}
                </p>
              </div>
            ) : (
              <SearchableSelect
                id="ev-target"
                label={
                  eventType === 'PENALTY_PLAY'
                    ? 'Goleiro adversário (alvo do pênalti)'
                    : eventType === 'GOAL'
                      ? 'Goleiro adversário (alvo do gol)'
                      : 'Jogador alvo (time adversário ao jogador principal)'
                }
                value={eventTargetId}
                onChange={setEventTargetId}
                options={targetPlayerSelectOptions}
                disabled={
                  !eventMainPlayer ||
                  !(
                    eventType === 'FOUL' ||
                    eventType === 'SUBSTITUTION' ||
                    eventType === 'GOAL' ||
                    eventType === 'PENALTY_PLAY'
                  )
                }
                emptyOption={{
                  value: '',
                  label:
                    !eventMainPlayer ||
                    !(
                      eventType === 'FOUL' ||
                      eventType === 'SUBSTITUTION' ||
                      eventType === 'GOAL' ||
                      eventType === 'PENALTY_PLAY'
                    )
                      ? '— Não se aplica para este tipo de lance —'
                      : '— Nenhum —',
                }}
              />
            )}
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
                <span style={{ flex: '1 1 12rem', minWidth: 0 }}>{eventLine(ev)}</span>
                {canDeleteEvents && lastEventId !== null && ev.id === lastEventId && (
                  <button
                    type="button"
                    className={s.btnRemove}
                    onClick={() => {
                      setDeleteEventId(ev.id);
                      setDeleteEventConfirmOpen(true);
                    }}
                  >
                    Excluir
                  </button>
                )}
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
        {canFinish && !matchEnded && focusPairReady && (
          <button
            type="button"
            className={s.btnPrimary}
            onClick={() => setFinishConfirmOpen(true)}
            disabled={finishing}
          >
            {finishing ? 'Finalizando…' : 'Finalizar partida e voltar'}
          </button>
        )}
        {canFinish && !matchEnded && !focusPairReady && (
          <p className={s.lead}>
            Selecione os <strong>dois times do confronto</strong> na seção &quot;Equipes desta partida&quot; para poder
            encerrar a partida.
          </p>
        )}
        {matchEnded && (
          <p className={s.lead}>
            <Link to="/matches#nova-partida">Ir para cadastrar nova partida</Link>
          </p>
        )}
        {!canFinish && !matchEnded && (
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
      <ConfirmModal
        open={deleteEventConfirmOpen}
        title="Excluir lance"
        message="Só é possível excluir o último lance registrado. Ele será removido permanentemente e as estatísticas da partida serão atualizadas."
        confirmLabel={deletingEvent ? 'Excluindo…' : 'Excluir'}
        cancelLabel="Cancelar"
        danger
        onCancel={() => {
          if (!deletingEvent) {
            setDeleteEventConfirmOpen(false);
            setDeleteEventId(null);
          }
        }}
        onConfirm={() => void executeDeleteEvent()}
      />
    </div>
  );
}
