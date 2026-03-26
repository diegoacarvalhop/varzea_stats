import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createEventForMatch,
  listEventsByMatch,
  type EventType,
  type MatchEvent,
} from '@/services/eventService';
import { listMediaForMatch, type MatchMediaItem } from '@/services/mediaService';
import { finishMatch, formatMatchPlacar, getMatch, type Match } from '@/services/matchService';
import {
  createPlayerForMatch,
  deletePlayerFromMatch,
  listPlayersByMatch,
  listPlayersDirectory,
  type Player,
  type PlayerDirectoryEntry,
} from '@/services/playerService';
import { buildMatchTeamNameChoices } from '@/lib/peladaTeamNames';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  listPresence,
  savePresence,
} from '@/services/peladaOpsService';
import { listPeladas, type Pelada } from '@/services/peladaService';
import { listTeamsByMatch, type Team } from '@/services/teamService';
import { listUsers, type UserSummary } from '@/services/userService';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MatchMediaGallery } from '@/components/MatchMediaGallery';
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import {
  EVENT_RECORDER_ROLES,
  hasAnyRole,
  MATCH_MANAGER_ROLES,
  PRESENCE_DRAFT_ROLES,
  ROSTER_EDITOR_ROLES,
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

/** Data local (calendário) a partir do instante da partida — alinhada à presença/sorteio da pelada. */
function instantToLocalDateIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function normalizeDirectoryNameForPresence(name: string): string {
  return name.trim().toLowerCase();
}

/** Diretório filtrado: só entradas ligadas a quem está marcado como presente (membro user id negativo ou nome igual a um presente). */
function filterDirectoryGroupsByPresent(
  groups: { label: string; entries: PlayerDirectoryEntry[] }[],
  presentUserIds: Set<number>,
  peladaUsers: UserSummary[],
): { label: string; entries: PlayerDirectoryEntry[] }[] {
  const presentNameNorm = new Set(
    peladaUsers.filter((u) => presentUserIds.has(u.id)).map((u) => normalizeDirectoryNameForPresence(u.name)),
  );
  const out: { label: string; entries: PlayerDirectoryEntry[] }[] = [];
  for (const g of groups) {
    const entries = g.entries.filter((e) => {
      if (e.playerId < 0) return presentUserIds.has(-e.playerId);
      return presentNameNorm.has(normalizeDirectoryNameForPresence(e.playerName));
    });
    if (entries.length > 0) out.push({ label: g.label, entries });
  }
  return out;
}

function findDirectoryEntryByPick(
  dir: PlayerDirectoryEntry[],
  pick: string,
): PlayerDirectoryEntry | null {
  const ci = pick.indexOf(':');
  const pidStr = ci >= 0 ? pick.slice(0, ci) : pick;
  const midStr = ci >= 0 ? pick.slice(ci + 1) : '';
  return (
    dir.find(
      (x) =>
        String(x.playerId) === pidStr && String(x.matchId ?? '') === (midStr || String(x.matchId ?? '')),
    ) ?? null
  );
}

function groupDirectoryForRoster(entries: PlayerDirectoryEntry[], currentMatchId: number) {
  const map = new Map<string, PlayerDirectoryEntry[]>();
  for (const e of entries) {
    const teamPart = e.teamName?.trim() || 'Equipe';
    const matchPart =
      e.matchId === currentMatchId
        ? 'esta partida'
        : e.matchId != null
          ? `Partida #${e.matchId}`
          : 'cadastro na pelada';
    const label = `${teamPart} · ${matchPart}`;
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const aHere = a.includes('esta partida');
      const bHere = b.includes('esta partida');
      if (aHere !== bHere) return aHere ? -1 : 1;
      return a.localeCompare(b, 'pt-BR');
    })
    .map(([label, group]) => ({
      label,
      entries: group.slice().sort((x, y) => {
        if (x.goalkeeper !== y.goalkeeper) return x.goalkeeper ? -1 : 1;
        return x.playerName.localeCompare(y.playerName, 'pt-BR');
      }),
    }));
}

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
  const canRoster = isAuthenticated && hasAnyRole(roles, ROSTER_EDITOR_ROLES);
  const canRecord = isAuthenticated && hasAnyRole(roles, EVENT_RECORDER_ROLES);
  const canFinish = isAuthenticated && hasAnyRole(roles, MATCH_MANAGER_ROLES);

  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [mediaItems, setMediaItems] = useState<MatchMediaItem[]>([]);

  const [draftPeladaUsers, setDraftPeladaUsers] = useState<UserSummary[]>([]);
  const [presentForDraft, setPresentForDraft] = useState<Set<number>>(new Set());
  const lastSavedPresenceKeyRef = useRef<string>('');
  const [loadingMatchDraft, setLoadingMatchDraft] = useState(false);
  const [removePlayerConfirm, setRemovePlayerConfirm] = useState<Player | null>(null);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [playerDirectory, setPlayerDirectory] = useState<PlayerDirectoryEntry[]>([]);

  const [newTeamName, setNewTeamName] = useState('');
  const [peladaForMatch, setPeladaForMatch] = useState<Pelada | null | undefined>(undefined);
  const [rosterPickByTeam, setRosterPickByTeam] = useState<Record<number, string>>({});
  const [playerGoalkeeperByTeam, setPlayerGoalkeeperByTeam] = useState<Record<number, boolean>>({});

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
  const effectiveCanRoster = canRoster && !matchFinished;
  const canDraftPresence =
    isAuthenticated &&
    hasAnyRole(roles, PRESENCE_DRAFT_ROLES) &&
    match != null &&
    !matchFinished;
  const configuredDurationMinutes = peladaForMatch?.matchDurationMinutes ?? 0;
  const timerConfigured = configuredDurationMinutes > 0;
  const timerEnded = timerConfigured && countdownSeconds === 0;

  const rosterDirectoryGroups = useMemo(
    () => groupDirectoryForRoster(playerDirectory, matchId),
    [playerDirectory, matchId],
  );

  const rosterGroupsForPicker = useMemo(() => {
    if (match?.peladaId == null) return rosterDirectoryGroups;
    if (loadingMatchDraft) return [];
    return filterDirectoryGroupsByPresent(rosterDirectoryGroups, presentForDraft, draftPeladaUsers);
  }, [match?.peladaId, loadingMatchDraft, rosterDirectoryGroups, presentForDraft, draftPeladaUsers]);

  const eventMainPlayer = useMemo(() => {
    if (!eventPlayerId) return null;
    const id = Number(eventPlayerId);
    if (!Number.isFinite(id)) return null;
    return players.find((p) => p.id === id) ?? null;
  }, [eventPlayerId, players]);

  const targetPlayerOptions = useMemo(() => {
    if (!eventMainPlayer) return players;
    return players.filter((p) => p.teamId !== eventMainPlayer.teamId);
  }, [eventMainPlayer, players]);

  const penaltyMainPlayer = useMemo(() => {
    if (!penaltyPlayerId) return null;
    const id = Number(penaltyPlayerId);
    if (!Number.isFinite(id)) return null;
    return players.find((p) => p.id === id) ?? null;
  }, [penaltyPlayerId, players]);

  const penaltyTargetOptions = useMemo(() => {
    if (!penaltyMainPlayer) return players;
    return players.filter((p) => p.teamId !== penaltyMainPlayer.teamId);
  }, [penaltyMainPlayer, players]);

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

  const directorySelectOptions = useMemo(() => {
    const out: SearchableSelectOption[] = [];
    for (const g of rosterGroupsForPicker) {
      for (const e of g.entries) {
        out.push({
          value: `${e.playerId}:${e.matchId ?? ''}`,
          label: `${e.playerName}${e.goalkeeper ? ' (Goleiro)' : ''}`,
          group: g.label,
        });
      }
    }
    return out;
  }, [rosterGroupsForPicker]);

  const eventTypeSelectOptions = useMemo(
    () => EVENT_TYPES.map((x) => ({ value: x.value, label: x.label })),
    [],
  );

  const eventPlayerSelectOptions = useMemo(() => buildPlayerOptionsByTeam(players, teams), [players, teams]);

  const teamNameChoices = useMemo(() => {
    if (peladaForMatch === undefined) return [];
    return buildMatchTeamNameChoices(peladaForMatch, teams);
  }, [peladaForMatch, teams]);

  const targetPlayerSelectOptions = useMemo(
    () => buildPlayerOptionsByTeam(targetPlayerOptions, teams),
    [targetPlayerOptions, teams],
  );

  const penaltyTargetSelectOptions = useMemo(
    () => buildPlayerOptionsByTeam(penaltyTargetOptions, teams),
    [penaltyTargetOptions, teams],
  );

  const refresh = useCallback(async () => {
    if (!Number.isFinite(matchId)) return;
    const [m, t, p, e, dir] = await Promise.all([
      getMatch(matchId),
      listTeamsByMatch(matchId),
      listPlayersByMatch(matchId),
      listEventsByMatch(matchId),
      listPlayersDirectory({ includePeladaMembers: true }).catch(() => [] as PlayerDirectoryEntry[]),
    ]);
    setMatch(m);
    setTeams(t);
    setPlayers(p);
    setEvents(e);
    setPlayerDirectory(dir);
    if (m?.peladaId != null) {
      try {
        const list = await listPeladas();
        setPeladaForMatch(list.find((x) => x.id === m.peladaId) ?? null);
      } catch {
        setPeladaForMatch(null);
      }
      setLoadingMatchDraft(true);
      try {
        const presenceDate = instantToLocalDateIso(m.date);
        const [users, presenceIds] = await Promise.all([
          listUsers(),
          listPresence(m.peladaId, presenceDate),
        ]);
        const pid = m.peladaId!;
        const memberIds = new Set(
          users
            .filter(
              (u) => u.peladaId === pid || (Array.isArray(u.peladaIds) && u.peladaIds.includes(pid)),
            )
            .map((u) => u.id),
        );
        setDraftPeladaUsers(users.filter((u) => memberIds.has(u.id)));
        const pidPresence = presenceIds ?? [];
        lastSavedPresenceKeyRef.current = [...pidPresence].sort((a, b) => a - b).join(',');
        setPresentForDraft(new Set(pidPresence));
      } catch {
        lastSavedPresenceKeyRef.current = '';
        setDraftPeladaUsers([]);
        setPresentForDraft(new Set());
      } finally {
        setLoadingMatchDraft(false);
      }
    } else {
      setPeladaForMatch(null);
      lastSavedPresenceKeyRef.current = '';
      setDraftPeladaUsers([]);
      setPresentForDraft(new Set());
      setLoadingMatchDraft(false);
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
    if (peladaForMatch === undefined) return;
    if (newTeamName && !teamNameChoices.includes(newTeamName)) {
      setNewTeamName('');
    }
  }, [peladaForMatch, teamNameChoices, newTeamName]);

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

  const presenceDateForMatch = match ? instantToLocalDateIso(match.date) : '';

  const presentForDraftKey = useMemo(
    () =>
      [...presentForDraft]
        .sort((a, b) => a - b)
        .join(','),
    [presentForDraft],
  );

  useEffect(() => {
    if (!match?.peladaId || !presenceDateForMatch || !canDraftPresence || loadingMatchDraft) return;
    if (presentForDraftKey === lastSavedPresenceKeyRef.current) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const ids = presentForDraftKey
            ? presentForDraftKey.split(',').map((x) => Number(x))
            : [];
          await savePresence(match.peladaId!, {
            date: presenceDateForMatch,
            presentUserIds: ids,
          });
          lastSavedPresenceKeyRef.current = presentForDraftKey;
        } catch (e) {
          appToast.error(getApiErrorMessage(e, 'Falha ao salvar presença.'));
        }
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [presentForDraftKey, match?.peladaId, presenceDateForMatch, canDraftPresence, loadingMatchDraft]);

  function rosterSlicesForTeam(teamId: number) {
    const teamPlayers = players.filter((p) => p.teamId === teamId);
    const firstFieldIdx = teamPlayers.findIndex((p) => !p.goalkeeper);
    const goalkeepers = firstFieldIdx === -1 ? teamPlayers : teamPlayers.slice(0, firstFieldIdx);
    const fieldPlayers = firstFieldIdx === -1 ? [] : teamPlayers.slice(firstFieldIdx);
    return { goalkeepers, fieldPlayers };
  }

  async function executeRemovePlayer(p: Player) {
    try {
      await deletePlayerFromMatch(matchId, p.id);
      appToast.success('Jogador removido da equipe.');
      await refresh();
    } catch {
      appToast.error('Falha ao remover jogador.');
    }
  }

  async function onCreatePlayer(e: FormEvent, teamId: number) {
    e.preventDefault();
    const pick = rosterPickByTeam[teamId] ?? '';
    const entry = findDirectoryEntryByPick(playerDirectory, pick);
    if (!entry) {
      appToast.warning('Selecione um jogador na lista da pelada.');
      return;
    }
    try {
      const isGk = playerGoalkeeperByTeam[teamId] ?? false;
      await createPlayerForMatch(matchId, teamId, {
        directoryRef: entry.playerId,
        goalkeeper: isGk,
      });
      setRosterPickByTeam((prev) => ({ ...prev, [teamId]: '' }));
      setPlayerGoalkeeperByTeam((prev) => ({ ...prev, [teamId]: false }));
      appToast.success('Jogador adicionado à equipe.');
      await refresh();
    } catch {
      appToast.error('Falha ao cadastrar jogador.');
    }
  }

  async function onCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (teams.length === 0) {
      appToast.warning('Cadastre ao menos uma equipe antes de registrar lances.');
      return;
    }
    if (players.length === 0) {
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
    if (teams.length === 0) {
      appToast.warning('Cadastre ao menos uma equipe antes de registrar pênaltis.');
      return;
    }
    if (players.length === 0) {
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
          <p className={s.placarHighlight}>{formatMatchPlacar(match.teamScores)}</p>
        </>
      )}

      {matchFinished && match?.finishedAt && (
        <p className={s.finishedBanner}>
          Partida encerrada em {new Date(match.finishedAt).toLocaleString('pt-BR')}. Resultado registrado:{' '}
          <strong>{formatMatchPlacar(match.teamScores)}</strong>. Escalação e novos lances estão bloqueados.
        </p>
      )}

      {match && mediaItems.length > 0 && <MatchMediaGallery items={mediaItems} />}

      <div className={s.card}>
        <h2 className={s.cardTitle}>1. Equipes desta partida</h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Os times já vêm da preparação de pré-jogo na tela de Partidas. Aqui você acompanha os elencos e pode fazer
          ajustes pontuais, se necessário.
        </p>
        {!matchFinished && !canRoster && (
          <p className={s.lead}>
            Apenas <strong>administradores</strong> (geral ou da pelada) ou <strong>SCOUT</strong> criam equipes e
            jogadores.
          </p>
        )}

        {teams.length === 0 && <p className={s.lead}>Nenhuma equipe ainda.</p>}

        <div className={s.teamGrid}>
          {teams.map((team) => (
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
                    {effectiveCanRoster && (
                      <button
                        type="button"
                        className={s.btnRemove}
                        onClick={() => setRemovePlayerConfirm(p)}
                      >
                        Remover
                      </button>
                    )}
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
              {effectiveCanRoster && (
                <form
                  className={s.form}
                  style={{ marginTop: '0.75rem' }}
                  onSubmit={(ev) => void onCreatePlayer(ev, team.id)}
                >
                  <SearchableSelect
                    id={`player-dir-${team.id}`}
                    label={
                      <>
                        Jogador presente / cadastro na pelada
                        <span className={s.requiredMark} aria-hidden>
                          *
                        </span>
                      </>
                    }
                    value={rosterPickByTeam[team.id] ?? ''}
                    aria-label="Escolher jogador para a equipe"
                    options={directorySelectOptions}
                    required
                    emptyOption={{
                      value: '',
                      label: rosterGroupsForPicker.length === 0 ? '— Ninguém disponível —' : '— Selecione o jogador —',
                    }}
                    onChange={(v) => {
                      setRosterPickByTeam((prev) => ({ ...prev, [team.id]: v }));
                      if (!v) return;
                      const picked = findDirectoryEntryByPick(playerDirectory, v);
                      if (picked) {
                        setPlayerGoalkeeperByTeam((prev) => ({
                          ...prev,
                          [team.id]: picked.goalkeeper,
                        }));
                      }
                    }}
                  />
                  <label className={s.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={playerGoalkeeperByTeam[team.id] ?? false}
                      onChange={(ev) =>
                        setPlayerGoalkeeperByTeam((prev) => ({
                          ...prev,
                          [team.id]: ev.target.checked,
                        }))
                      }
                    />
                    <span>É o goleiro desta equipe</span>
                  </label>
                  <button
                    className={s.btn}
                    type="submit"
                    disabled={!rosterPickByTeam[team.id]}
                  >
                    Adicionar jogador
                  </button>
                </form>
              )}
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
        open={removePlayerConfirm != null}
        title="Remover jogador"
        message={
          removePlayerConfirm
            ? `Remover ${removePlayerConfirm.name} da equipe? Lance antigos ligados a ele ficam sem jogador na escalação.`
            : ''
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setRemovePlayerConfirm(null)}
        onConfirm={() => {
          const p = removePlayerConfirm;
          setRemovePlayerConfirm(null);
          if (p) void executeRemovePlayer(p);
        }}
      />
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
