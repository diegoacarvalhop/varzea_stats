import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  cancelMatch,
  createMatch,
  deleteMatchPermanently,
  formatMatchPlacarForListItem,
  getCurrentOpenMatch,
  listMatches,
  type Match,
} from '@/services/matchService';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { hasAnyRole, MATCH_MANAGER_ROLES } from '@/lib/roles';
import { appToast } from '@/lib/appToast';
import { fromDatetimeLocalToUtcIso, toDatetimeLocalString } from '@/utils/datetimeLocal';
import { applyDraftToMatch } from '@/services/playerService';
import { createTeamForMatch } from '@/services/teamService';
import { listPresence, runDraft, savePresence, getDraftResult, type DraftTeamLine } from '@/services/peladaOpsService';
import { listUsers, type UserSummary } from '@/services/userService';
import { listPeladas, type Pelada } from '@/services/peladaService';
import { buildMatchTeamNameChoices } from '@/lib/peladaTeamNames';
import s from '@/styles/pageShared.module.scss';

function instantToLocalDateIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function isMensalistaOnPelada(u: UserSummary, peladaId: number): boolean {
  return u.billingMonthlyByPelada?.[String(peladaId)] !== false;
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function resolveLiveTimerFromStorage(matchId: number, nowMs: number): string {
  try {
    const raw = window.localStorage.getItem(`match:timer:${matchId}`);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { remainingSeconds?: number; running?: boolean; savedAtMs?: number };
    if (!parsed.running || !Number.isFinite(parsed.remainingSeconds) || !Number.isFinite(parsed.savedAtMs)) return '';
    const elapsed = Math.max(0, Math.floor((nowMs - Number(parsed.savedAtMs)) / 1000));
    const remaining = Math.max(0, Math.floor(Number(parsed.remainingSeconds)) - elapsed);
    if (remaining <= 0) return '';
    return `⏱ ${formatCountdown(remaining)}`;
  } catch {
    return '';
  }
}

export function MatchesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, roles, peladaId } = useAuth();
  const canCreate = isAuthenticated && hasAnyRole(roles, MATCH_MANAGER_ROLES);

  const [matches, setMatches] = useState<Match[]>([]);
  /** Mesma regra do GET /matches/open: partida aberta mais recente da pelada (em andamento). */
  const [currentOpenMatchId, setCurrentOpenMatchId] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => toDatetimeLocalString());
  const [peladaForMatch, setPeladaForMatch] = useState<Pelada | null | undefined>(undefined);
  const [draftPeladaUsers, setDraftPeladaUsers] = useState<UserSummary[]>([]);
  const [presentForDraft, setPresentForDraft] = useState<Set<number>>(new Set());
  const [loadingPregame, setLoadingPregame] = useState(false);
  const [runningDraft, setRunningDraft] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftTeamLine[]>([]);
  const [teamNameToAdd, setTeamNameToAdd] = useState('');
  const [pregameTeams, setPregameTeams] = useState<string[]>([]);
  const [goalkeeperByTeam, setGoalkeeperByTeam] = useState<Record<string, number>>({});
  const [goalkeeperPickByTeam, setGoalkeeperPickByTeam] = useState<Record<string, string>>({});
  const [playerPickByTeam, setPlayerPickByTeam] = useState<Record<string, string>>({});
  const [creatingMatch, setCreatingMatch] = useState(false);
  const lastSavedPresenceKeyRef = useRef<string>('');
  /** Só permite gravar presença no servidor depois de carregar o dia (evita apagar tudo antes do GET). */
  const presenceAllowAutosaveRef = useRef(false);
  const pregameLoadGenRef = useRef(0);
  const [pregameHydrated, setPregameHydrated] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [cancelingMatch, setCancelingMatch] = useState(false);
  const [deletingMatch, setDeletingMatch] = useState(false);

  useEffect(() => {
    const tid = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tid);
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const [data, open] = await Promise.all([listMatches(), getCurrentOpenMatch()]);
      setMatches(data);
      setCurrentOpenMatchId(open?.id ?? null);
    } catch {
      appToast.error('Não foi possível carregar as partidas.');
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    if (window.location.hash !== '#nova-partida') return;
    if (!canCreate) {
      window.history.replaceState(null, '', '/matches');
      return;
    }
    const id = window.requestAnimationFrame(() => {
      document.getElementById('nova-partida')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', '/matches');
    });
    return () => window.cancelAnimationFrame(id);
  }, [canCreate]);

  const presenceDateForDraft = useMemo(() => instantToLocalDateIso(fromDatetimeLocalToUtcIso(date)), [date]);

  const draftMembersSorted = useMemo(() => {
    const list = [...draftPeladaUsers];
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return list;
  }, [draftPeladaUsers]);

  const presenceByBilling = useMemo(() => {
    if (peladaId == null) return { monthly: [] as UserSummary[], daily: [] as UserSummary[], goalkeepers: [] as UserSummary[] };
    const monthly: UserSummary[] = [];
    const daily: UserSummary[] = [];
    const goalkeepers: UserSummary[] = [];
    for (const u of draftMembersSorted) {
      if (u.goalkeeper) {
        goalkeepers.push(u);
        continue;
      }
      if (isMensalistaOnPelada(u, peladaId)) monthly.push(u);
      else daily.push(u);
    }
    return { monthly, daily, goalkeepers };
  }, [draftMembersSorted, peladaId]);

  const presentForDraftKey = useMemo(
    () =>
      [...presentForDraft]
        .sort((a, b) => a - b)
        .join(','),
    [presentForDraft],
  );

  const teamNameChoices = useMemo(() => {
    if (peladaForMatch === undefined) return [];
    return buildMatchTeamNameChoices(
      peladaForMatch,
      pregameTeams.map((name, idx) => ({ id: idx + 1, name, matchId: 0 })),
    );
  }, [peladaForMatch, pregameTeams]);

  const presentUsersSorted = useMemo(() => {
    return draftMembersSorted.filter((u) => presentForDraft.has(u.id));
  }, [draftMembersSorted, presentForDraft]);

  const presentGoalkeepersSorted = useMemo(() => {
    return presentUsersSorted.filter((u) => u.goalkeeper);
  }, [presentUsersSorted]);

  const selectedGoalkeeperIds = useMemo(() => {
    const ids = pregameTeams
      .map((team) => Number(goalkeeperByTeam[team]))
      .filter((id) => Number.isFinite(id) && id > 0);
    return Array.from(new Set(ids));
  }, [pregameTeams, goalkeeperByTeam]);

  const pregameStorageKey = useMemo(() => {
    if (peladaId == null) return '';
    return `pregame:${peladaId}`;
  }, [peladaId]);

  const draftedPlayerIds = useMemo(() => {
    const ids = new Set<number>();
    for (const line of draftLines) {
      for (const p of line.players) ids.add(p.userId);
    }
    return ids;
  }, [draftLines]);

  const undraftedPresentFieldPlayers = useMemo(() => {
    return presentUsersSorted.filter((u) => !u.goalkeeper && !draftedPlayerIds.has(u.id));
  }, [presentUsersSorted, draftedPlayerIds]);

  const loadPregame = useCallback(async () => {
    if (!canCreate || peladaId == null) return;
    const gen = ++pregameLoadGenRef.current;
    presenceAllowAutosaveRef.current = false;
    setLoadingPregame(true);
    try {
      const [users, presenceIds, draftResult, peladas] = await Promise.all([
        listUsers(),
        listPresence(peladaId, presenceDateForDraft),
        getDraftResult(peladaId, presenceDateForDraft).catch(() => [] as DraftTeamLine[]),
        listPeladas(),
      ]);
      if (gen !== pregameLoadGenRef.current) {
        return;
      }
      const memberIds = new Set(
        users
          .filter(
            (u) =>
              (u.peladaId === peladaId || (Array.isArray(u.peladaIds) && u.peladaIds.includes(peladaId))) &&
              Array.isArray(u.roles) &&
              u.roles.includes('PLAYER'),
          )
          .map((u) => u.id),
      );
      const members = users.filter((u) => memberIds.has(u.id));
      setDraftPeladaUsers(members);
      const present = presenceIds ?? [];
      lastSavedPresenceKeyRef.current = [...present].sort((a, b) => a - b).join(',');
      setPresentForDraft(new Set(present));
      setDraftLines(draftResult);
      if (draftResult.length > 0) setPregameTeams(draftResult.map((l) => l.teamName));
      if (draftResult.length > 0) {
        const fromDraft: Record<string, number> = {};
        for (const line of draftResult) {
          const gk = line.players.find((p) => p.goalkeeper === true);
          if (gk) fromDraft[line.teamName] = gk.userId;
        }
        setGoalkeeperByTeam((prev) => ({ ...prev, ...fromDraft }));
      }
      setPeladaForMatch(peladas.find((p) => p.id === peladaId) ?? null);
      presenceAllowAutosaveRef.current = true;
    } catch {
      if (gen !== pregameLoadGenRef.current) {
        return;
      }
      setDraftPeladaUsers([]);
      setPresentForDraft(new Set());
      setDraftLines([]);
      setPeladaForMatch(null);
      lastSavedPresenceKeyRef.current = '';
      presenceAllowAutosaveRef.current = true;
      appToast.error('Não foi possível carregar a preparação da partida.');
    } finally {
      if (gen === pregameLoadGenRef.current) {
        setLoadingPregame(false);
      }
    }
  }, [canCreate, peladaId, presenceDateForDraft]);

  useEffect(() => {
    void loadPregame();
  }, [loadPregame]);

  useEffect(() => {
    if (!canCreate || peladaId == null) return;
    if (!presenceAllowAutosaveRef.current) return;
    if (presentForDraftKey === lastSavedPresenceKeyRef.current) return;
    const tid = window.setTimeout(() => {
      void (async () => {
        try {
          const ids = presentForDraftKey ? presentForDraftKey.split(',').map((x) => Number(x)) : [];
          await savePresence(peladaId, { date: presenceDateForDraft, presentUserIds: ids });
          lastSavedPresenceKeyRef.current = presentForDraftKey;
        } catch {
          appToast.error('Falha ao salvar presença do dia.');
        }
      })();
    }, 350);
    return () => window.clearTimeout(tid);
  }, [canCreate, peladaId, presenceDateForDraft, presentForDraftKey]);

  /** Restaura data / times / sorteio do armazenamento local ANTES do primeiro fetch (mesmo dia da API). */
  useLayoutEffect(() => {
    if (!pregameStorageKey) {
      setPregameHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(pregameStorageKey);
      if (!raw) {
        setPregameHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        date?: string;
        teams?: string[];
        goalkeeperByTeam?: Record<string, number>;
        draftLines?: DraftTeamLine[];
      };
      if (typeof parsed.date === 'string' && parsed.date.trim()) setDate(parsed.date);
      if (Array.isArray(parsed.teams)) setPregameTeams(parsed.teams);
      if (parsed.goalkeeperByTeam && typeof parsed.goalkeeperByTeam === 'object') {
        setGoalkeeperByTeam(parsed.goalkeeperByTeam);
      }
      if (Array.isArray(parsed.draftLines)) {
        setDraftLines(parsed.draftLines);
      }
    } catch {
      // no-op
    } finally {
      setPregameHydrated(true);
    }
  }, [pregameStorageKey]);

  useEffect(() => {
    if (!pregameStorageKey) return;
    if (!pregameHydrated) return;
    try {
      window.localStorage.setItem(
        pregameStorageKey,
        JSON.stringify({
          date,
          teams: pregameTeams,
          goalkeeperByTeam,
          draftLines,
        }),
      );
    } catch {
      // no-op
    }
  }, [pregameStorageKey, pregameHydrated, date, pregameTeams, goalkeeperByTeam, draftLines]);

  useEffect(() => {
    setGoalkeeperByTeam((prev) => {
      const out: Record<string, number> = {};
      for (const team of pregameTeams) {
        const gk = prev[team];
        if (gk != null) out[team] = gk;
      }
      return out;
    });
  }, [pregameTeams]);

  useEffect(() => {
    setDraftLines((prev) => prev.filter((line) => pregameTeams.includes(line.teamName)));
  }, [pregameTeams]);

  async function onCreateMatch(e: FormEvent) {
    e.preventDefault();
    if (pregameTeams.length < 2) {
      appToast.warning('Adicione ao menos 2 times na preparação.');
      return;
    }
    if (pregameTeams.some((team) => !goalkeeperByTeam[team])) {
      appToast.warning('Defina o goleiro de cada time antes de criar a partida.');
      return;
    }
    if (draftLines.length === 0) {
      appToast.warning('Faça o sorteio antes de criar a partida.');
      return;
    }
    setCreatingMatch(true);
    try {
      const instant = fromDatetimeLocalToUtcIso(date);
      const created = await createMatch({ date: instant, location: location.trim() });
      const draftByTeam = new Map(draftLines.map((line) => [line.teamName, line]));
      for (const teamName of pregameTeams) {
        await createTeamForMatch(created.id, teamName);
      }
      await applyDraftToMatch(created.id, {
        lines: pregameTeams.map((teamName, idx) => {
          const line = draftByTeam.get(teamName);
          const gkId = goalkeeperByTeam[teamName];
          const slots = [...(line?.players ?? [])];
          if (gkId && !slots.some((s) => s.userId === gkId)) {
            const gkName = draftPeladaUsers.find((u) => u.id === gkId)?.name ?? `Jogador ${gkId}`;
            slots.unshift({ userId: gkId, userName: gkName, skillScore: 0, goalkeeper: true });
          }
          return {
            teamName,
            teamIndex: line?.teamIndex ?? idx,
            slots: slots.map((slot) => ({ userId: slot.userId, goalkeeper: slot.goalkeeper === true })),
          };
        }),
      });
      setLocation('');
      setDate(toDatetimeLocalString());
      appToast.success('Partida criada. Abrindo a tela da partida…');
      await loadMatches();
      navigate(`/matches/${created.id}`, { replace: false });
    } catch {
      appToast.error('Falha ao criar partida. Verifique permissões (administrador, SCOUT ou MEDIA).');
    } finally {
      setCreatingMatch(false);
    }
  }

  function togglePresent(userId: number, on: boolean) {
    setPresentForDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  function addTeamToPregame() {
    const name = teamNameToAdd.trim();
    if (!name) return;
    setPregameTeams((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setTeamNameToAdd('');
  }

  function removeTeamFromPregame(name: string) {
    setPregameTeams((prev) => prev.filter((x) => x !== name));
    setGoalkeeperByTeam((prev) => {
      const out = { ...prev };
      delete out[name];
      return out;
    });
    setGoalkeeperPickByTeam((prev) => {
      const out = { ...prev };
      delete out[name];
      return out;
    });
    setPlayerPickByTeam((prev) => {
      const out = { ...prev };
      delete out[name];
      return out;
    });
    setDraftLines((prev) => prev.filter((line) => line.teamName !== name));
  }

  function defineGoalkeeperForTeam(teamName: string) {
    const pick = Number(goalkeeperPickByTeam[teamName] ?? '');
    if (!Number.isFinite(pick) || pick <= 0) {
      appToast.warning('Selecione o jogador goleiro para a equipe.');
      return;
    }
    if (!presentForDraft.has(pick)) {
      appToast.warning('O goleiro precisa estar marcado como presente.');
      return;
    }
    const pickedUser = draftPeladaUsers.find((u) => u.id === pick);
    if (!pickedUser?.goalkeeper) {
      appToast.warning('Selecione um usuário marcado como goleiro.');
      return;
    }
    setGoalkeeperByTeam((prev) => ({ ...prev, [teamName]: pick }));
    setDraftLines((prev) => {
      const existing = prev.find((line) => line.teamName === teamName);
      const userName = draftPeladaUsers.find((u) => u.id === pick)?.name ?? `Jogador ${pick}`;
      const nextPlayer = { userId: pick, userName, skillScore: 0, goalkeeper: true };
      if (!existing) {
        return [
          ...prev,
          {
            teamIndex: pregameTeams.findIndex((t) => t === teamName),
            teamName,
            players: [nextPlayer],
          },
        ];
      }
      // Ao trocar o goleiro, o anterior sai do time (não vira jogador de linha).
      const filtered = existing.players
        .filter((p) => p.userId !== pick)
        .filter((p) => !p.goalkeeper)
        .map((p) => ({ ...p, goalkeeper: false }));
      const updated = { ...existing, players: [nextPlayer, ...filtered] };
      return prev.map((line) => (line.teamName === teamName ? updated : line));
    });
    appToast.success('Goleiro definido para a equipe.');
  }

  function clearGoalkeeperForTeam(teamName: string) {
    setGoalkeeperByTeam((prev) => {
      const out = { ...prev };
      delete out[teamName];
      return out;
    });
    setDraftLines((prev) =>
      prev.map((line) =>
        line.teamName !== teamName
          ? line
          : {
              ...line,
              players: line.players.filter((p) => p.goalkeeper !== true),
            },
      ),
    );
  }

  function addFieldPlayerToTeam(teamName: string) {
    const pick = Number(playerPickByTeam[teamName] ?? '');
    if (!Number.isFinite(pick) || pick <= 0) {
      appToast.warning('Selecione um jogador de linha para adicionar.');
      return;
    }
    const selected = undraftedPresentFieldPlayers.find((u) => u.id === pick);
    if (!selected) {
      appToast.warning('Esse jogador não está disponível para inclusão.');
      return;
    }
    setDraftLines((prev) => {
      const existing = prev.find((line) => line.teamName === teamName);
      const slot = { userId: selected.id, userName: selected.name, skillScore: 0, goalkeeper: false };
      if (!existing) {
        return [
          ...prev,
          {
            teamIndex: pregameTeams.findIndex((t) => t === teamName),
            teamName,
            players: [slot],
          },
        ];
      }
      if (existing.players.some((p) => p.userId === selected.id)) return prev;
      const updated = { ...existing, players: [...existing.players, slot] };
      return prev.map((line) => (line.teamName === teamName ? updated : line));
    });
    setPlayerPickByTeam((prev) => ({ ...prev, [teamName]: '' }));
  }

  function removeFieldPlayerFromTeam(teamName: string, userId: number) {
    setDraftLines((prev) =>
      prev.map((line) =>
        line.teamName !== teamName
          ? line
          : {
              ...line,
              players: line.players.filter((p) => p.userId !== userId || p.goalkeeper === true),
            },
      ),
    );
  }

  async function onRunDraft() {
    if (peladaId == null) return;
    if (pregameTeams.length < 2) {
      appToast.warning('Adicione ao menos 2 times para sortear.');
      return;
    }
    if (pregameTeams.some((team) => !goalkeeperByTeam[team])) {
      appToast.warning('Defina o goleiro de cada time antes de sortear.');
      return;
    }
    if (presentForDraft.size < 2) {
      appToast.warning('Marque ao menos 2 presentes para sortear.');
      return;
    }
    setRunningDraft(true);
    try {
      const presentIds = [...presentForDraft].sort((a, b) => a - b);
      await savePresence(peladaId, { date: presenceDateForDraft, presentUserIds: presentIds });
      lastSavedPresenceKeyRef.current = presentIds.join(',');
      const result = await runDraft(peladaId, {
        date: presenceDateForDraft,
        teamNames: pregameTeams,
        goalkeeperUserIds: selectedGoalkeeperIds,
        goalkeeperByTeam,
      });
      setDraftLines(result);
      appToast.success('Times sorteados.');
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Falha ao sortear times.'));
    } finally {
      setRunningDraft(false);
    }
  }

  async function executeCancelMatch() {
    if (cancelTargetId == null) return;
    const id = cancelTargetId;
    setCancelTargetId(null);
    setCancelingMatch(true);
    try {
      await cancelMatch(id);
      appToast.success('Partida cancelada.');
      await loadMatches();
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível cancelar a partida.'));
    } finally {
      setCancelingMatch(false);
    }
  }

  async function executeDeleteMatch() {
    if (deleteTargetId == null) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    setDeletingMatch(true);
    try {
      await deleteMatchPermanently(id);
      appToast.success('Partida excluída.');
      await loadMatches();
    } catch (err) {
      appToast.error(getApiErrorMessage(err, 'Não foi possível excluir a partida.'));
    } finally {
      setDeletingMatch(false);
    }
  }

  return (
    <div className={s.page}>
      <h1>Partidas</h1>
      <p className={s.lead}>
        Crie uma partida e abra o <strong>detalhe</strong> para montar as equipes, jogadores e registrar todos os
        lances desta pelada. Os stats só fazem sentido no contexto de cada jogo.
      </p>
      {canCreate && (
        <div className={s.card} style={{ marginTop: '1.25rem' }}>
          <h2 className={s.cardTitle}>Pré-jogo (presença, times e sorteio)</h2>
          <p className={s.lead}>Prepare o dia aqui. A nova partida já será criada com os times sorteados.</p>
          {loadingPregame ? (
            <p className={s.lead}>Carregando pré-jogo…</p>
          ) : (
            <>
              <p className={s.statsDetailMeta}>
                Data de referência: <strong>{presenceDateForDraft}</strong>
              </p>
              <div style={{ marginTop: '1rem' }}>
                <p className={s.fieldLabel}>1) Sorteio</p>
                <p className={s.statsDetailMeta} style={{ marginTop: 0 }}>
                  O goleiro de cada time fica fora do sorteio. O mesmo goleiro pode ser usado em mais de um time.
                </p>
                <button type="button" className={s.btnPrimary} disabled={runningDraft} onClick={() => void onRunDraft()}>
                  {runningDraft ? 'Sorteando…' : 'Sortear times'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
                  gap: '1.25rem',
                  alignItems: 'start',
                }}
              >
                <div>
                  <p className={s.fieldLabel}>2) Presença - Mensalistas</p>
                  {presenceByBilling.monthly.map((u) => (
                    <label key={u.id} className={s.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={presentForDraft.has(u.id)}
                        onChange={(ev) => togglePresent(u.id, ev.target.checked)}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <p className={s.fieldLabel}>2) Presença - Diaristas</p>
                  {presenceByBilling.daily.map((u) => (
                    <label key={u.id} className={s.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={presentForDraft.has(u.id)}
                        onChange={(ev) => togglePresent(u.id, ev.target.checked)}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <p className={s.fieldLabel}>2) Presença - Goleiros</p>
                  {presenceByBilling.goalkeepers.map((u) => (
                    <label key={u.id} className={s.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={presentForDraft.has(u.id)}
                        onChange={(ev) => togglePresent(u.id, ev.target.checked)}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <p className={s.fieldLabel}>3) Times do dia (com goleiro)</p>
                <div className={s.formInline}>
                  <select
                    className={`${s.input} ${s.select}`}
                    value={teamNameToAdd}
                    onChange={(ev) => setTeamNameToAdd(ev.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {teamNameChoices.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={s.btn} onClick={addTeamToPregame}>
                    Adicionar
                  </button>
                </div>
                {pregameTeams.length > 0 ? (
                  <div
                    className={s.teamGrid}
                    style={{ marginTop: '0.75rem', gridTemplateColumns: 'repeat(2, minmax(18rem, 1fr))' }}
                  >
                    {pregameTeams.map((name) => {
                      const line = draftLines.find((l) => l.teamName === name);
                      const persistedGoalkeeper = line?.players.find((p) => p.goalkeeper === true);
                      const gkId = persistedGoalkeeper?.userId ?? goalkeeperByTeam[name];
                      const gkName = draftPeladaUsers.find((u) => u.id === gkId)?.name ?? '—';
                      const draftedSlots = (line?.players ?? []).filter((p) => p.goalkeeper !== true);
                      return (
                        <div key={name} className={s.teamCard}>
                          <h3 className={s.teamTitle}>{name}</h3>
                          <ul className={s.rosterList}>
                            <li className={s.rosterRow}>
                              <span className={s.rosterName}>
                                {gkName}
                                <span className={s.gkBadge}>Goleiro</span>
                              </span>
                              {gkId != null && (
                                <button
                                  type="button"
                                  className={s.btnRemove}
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                  onClick={() => clearGoalkeeperForTeam(name)}
                                >
                                  Excluir
                                </button>
                              )}
                            </li>
                            {draftedSlots.map((slot) => (
                              <li key={`${name}-${slot.userId}`} className={s.rosterRow}>
                                <span className={s.rosterName}>{slot.userName}</span>
                                <button
                                  type="button"
                                  className={s.btnRemove}
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                  onClick={() => removeFieldPlayerFromTeam(name, slot.userId)}
                                >
                                  Excluir
                                </button>
                              </li>
                            ))}
                          </ul>
                          <div className={s.form} style={{ marginTop: '0.75rem' }}>
                            <div className={s.field}>
                              <label className={s.fieldLabel}>Jogador presente / cadastro na pelada</label>
                              <select
                                className={`${s.input} ${s.select}`}
                                value={goalkeeperPickByTeam[name] ?? ''}
                                onChange={(ev) =>
                                  setGoalkeeperPickByTeam((prev) => ({ ...prev, [name]: ev.target.value }))
                                }
                              >
                                <option value="">— Selecione o jogador —</option>
                                {presentGoalkeepersSorted.map((u) => (
                                  <option key={`${name}-${u.id}`} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button type="button" className={s.btn} onClick={() => defineGoalkeeperForTeam(name)}>
                              Definir goleiro
                            </button>
                            <div className={s.field}>
                              <label className={s.fieldLabel}>Adicionar jogador de linha</label>
                              <select
                                className={`${s.input} ${s.select}`}
                                value={playerPickByTeam[name] ?? ''}
                                onChange={(ev) => setPlayerPickByTeam((prev) => ({ ...prev, [name]: ev.target.value }))}
                              >
                                <option value="">— Selecione —</option>
                                {undraftedPresentFieldPlayers.map((u) => (
                                  <option key={`${name}-line-${u.id}`} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button type="button" className={s.btn} onClick={() => addFieldPlayerToTeam(name)}>
                              Adicionar jogador
                            </button>
                          </div>
                          <button
                            type="button"
                            className={s.btnRemove}
                            style={{ marginTop: '0.6rem' }}
                            onClick={() => removeTeamFromPregame(name)}
                          >
                            Excluir time
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={s.statsDetailMeta}>Nenhum time definido.</p>
                )}
              </div>

            </>
          )}
        </div>
      )}
      {canCreate && (
        <div className={s.card} id="nova-partida">
          <h2 className={s.cardTitle}>Nova partida</h2>
          <form className={s.form} onSubmit={onCreateMatch}>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="match-datetime">
                Data e hora
                <span className={s.requiredMark} aria-hidden>
                  *
                </span>
              </label>
              <input
                id="match-datetime"
                className={s.input}
                type="datetime-local"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                required
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="match-location">
                Local / campo
                <span className={s.requiredMark} aria-hidden>
                  *
                </span>
              </label>
              <input
                id="match-location"
                className={s.input}
                value={location}
                onChange={(ev) => setLocation(ev.target.value)}
                required
                placeholder="Ex.: Campo do Juqueri"
              />
            </div>
            <button className={s.btnPrimary} type="submit">
              {creatingMatch ? 'Criando…' : 'Criar e ir para a partida'}
            </button>
          </form>
        </div>
      )}

      {!canCreate && (
        <p className={s.lead}>
          Faça login como <strong>administrador</strong>, <strong>SCOUT</strong> ou <strong>MEDIA</strong> para criar
          partidas.
        </p>
      )}

      <h2 className={s.cardTitle} style={{ marginTop: '0.5rem' }}>
        Jogos
      </h2>
      {canCreate && (
        <p className={s.statsDetailMeta} style={{ marginBottom: '0.75rem' }}>
          Em cada partida: <strong>Cancelar</strong> (só aberta) ou <strong>Excluir</strong> (apaga tudo na base). Partidas
          encerradas só podem ser excluídas.
        </p>
      )}
      <ul className={s.matchList}>
        {matches.map((m) => {
          const isOpen =
            (m.finishedAt == null || m.finishedAt === '') && (m.cancelledAt == null || m.cancelledAt === '');
          return (
            <li key={m.id} className={s.matchItem}>
              <div className={s.matchRow}>
                <Link to={`/matches/${m.id}`} className={s.matchLink}>
                  <span className={s.matchId}>#{m.id}</span>
                  {m.cancelledAt != null && m.cancelledAt !== '' && (
                    <span className={s.matchCancelledTag}>Cancelada</span>
                  )}
                  {m.finishedAt != null && m.finishedAt !== '' && (m.cancelledAt == null || m.cancelledAt === '') && (
                    <span className={s.matchFinishedTag}>Encerrada</span>
                  )}
                  {isOpen && currentOpenMatchId === m.id && (
                    <span className={s.matchInProgressTag}>Em andamento</span>
                  )}
                  <span className={s.matchMeta}>{new Date(m.date).toLocaleString('pt-BR')}</span>
                  <span className={s.matchMeta}>{m.location}</span>
                  <span className={s.matchPlacar}>
                    {formatMatchPlacarForListItem(m)}
                    {!m.finishedAt &&
                      (m.cancelledAt == null || m.cancelledAt === '') &&
                      resolveLiveTimerFromStorage(m.id, nowMs) && (
                        <span className={s.matchTimerInline}>{resolveLiveTimerFromStorage(m.id, nowMs)}</span>
                      )}
                  </span>
                  <span className={s.matchChevron}>→</span>
                </Link>
                {canCreate && (
                  <div
                    className={s.matchActions}
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                    }}
                  >
                    {isOpen && (
                      <button
                        type="button"
                        className={s.btn}
                        disabled={cancelingMatch || deletingMatch}
                        onClick={() => setCancelTargetId(m.id)}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      className={s.btnRemove}
                      disabled={cancelingMatch || deletingMatch}
                      onClick={() => setDeleteTargetId(m.id)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmModal
        open={cancelTargetId != null}
        title="Cancelar partida"
        message="A partida ficará com status CANCELADA. Não haverá placar de encerramento normal para esta partida."
        confirmLabel={cancelingMatch ? 'Cancelando…' : 'Confirmar cancelamento'}
        cancelLabel="Voltar"
        danger
        onCancel={() => !cancelingMatch && setCancelTargetId(null)}
        onConfirm={() => void executeCancelMatch()}
      />
      <ConfirmModal
        open={deleteTargetId != null}
        title="Excluir partida permanentemente"
        message="Todos os registros desta partida serão apagados na base de dados: lances, pênaltis, jogadores, equipes, placar e mídia vinculada. Esta ação não pode ser desfeita."
        confirmLabel={deletingMatch ? 'Excluindo…' : 'Excluir tudo'}
        cancelLabel="Voltar"
        danger
        onCancel={() => !deletingMatch && setDeleteTargetId(null)}
        onConfirm={() => void executeDeleteMatch()}
      />
    </div>
  );
}
