import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createMatch, formatMatchPlacar, listMatches, type Match } from '@/services/matchService';
import { useAuth } from '@/hooks/useAuth';
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

export function MatchesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, roles, peladaId } = useAuth();
  const canCreate = isAuthenticated && hasAnyRole(roles, MATCH_MANAGER_ROLES);

  const [matches, setMatches] = useState<Match[]>([]);
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
  const [creatingMatch, setCreatingMatch] = useState(false);
  const lastSavedPresenceKeyRef = useRef<string>('');

  const loadMatches = useCallback(async () => {
    try {
      const data = await listMatches();
      setMatches(data);
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
    if (peladaId == null) return { monthly: [] as UserSummary[], daily: [] as UserSummary[] };
    const monthly: UserSummary[] = [];
    const daily: UserSummary[] = [];
    for (const u of draftMembersSorted) {
      if (isMensalistaOnPelada(u, peladaId)) monthly.push(u);
      else daily.push(u);
    }
    return { monthly, daily };
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

  const selectedGoalkeeperIds = useMemo(
    () => Object.values(goalkeeperByTeam).filter((id): id is number => Number.isFinite(id)),
    [goalkeeperByTeam],
  );

  const pregameStorageKey = useMemo(() => {
    if (peladaId == null) return '';
    return `pregame:${peladaId}:${presenceDateForDraft}`;
  }, [peladaId, presenceDateForDraft]);

  const draftedPlayersByTeam = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const line of draftLines) {
      map.set(
        line.teamName,
        line.players.map((p) => p.userName),
      );
    }
    return map;
  }, [draftLines]);

  const loadPregame = useCallback(async () => {
    if (!canCreate || peladaId == null) return;
    setLoadingPregame(true);
    try {
      const [users, presenceIds, draftResult, peladas] = await Promise.all([
        listUsers(),
        listPresence(peladaId, presenceDateForDraft),
        getDraftResult(peladaId, presenceDateForDraft).catch(() => [] as DraftTeamLine[]),
        listPeladas(),
      ]);
      const memberIds = new Set(
        users
          .filter((u) => u.peladaId === peladaId || (Array.isArray(u.peladaIds) && u.peladaIds.includes(peladaId)))
          .map((u) => u.id),
      );
      const members = users.filter((u) => memberIds.has(u.id));
      setDraftPeladaUsers(members);
      const present = presenceIds ?? [];
      lastSavedPresenceKeyRef.current = [...present].sort((a, b) => a - b).join(',');
      setPresentForDraft(new Set(present));
      setDraftLines(draftResult);
      if (draftResult.length > 0) setPregameTeams(draftResult.map((l) => l.teamName));
      setPeladaForMatch(peladas.find((p) => p.id === peladaId) ?? null);
    } catch {
      setDraftPeladaUsers([]);
      setPresentForDraft(new Set());
      setDraftLines([]);
      setPeladaForMatch(null);
      appToast.error('Não foi possível carregar a preparação da partida.');
    } finally {
      setLoadingPregame(false);
    }
  }, [canCreate, peladaId, presenceDateForDraft]);

  useEffect(() => {
    void loadPregame();
  }, [loadPregame]);

  useEffect(() => {
    if (!canCreate || peladaId == null) return;
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

  useEffect(() => {
    if (!pregameStorageKey) return;
    try {
      const raw = window.localStorage.getItem(pregameStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { teams?: string[]; goalkeeperByTeam?: Record<string, number> };
      if (Array.isArray(parsed.teams)) setPregameTeams(parsed.teams);
      if (parsed.goalkeeperByTeam && typeof parsed.goalkeeperByTeam === 'object') {
        setGoalkeeperByTeam(parsed.goalkeeperByTeam);
      }
    } catch {
      // no-op
    }
  }, [pregameStorageKey]);

  useEffect(() => {
    if (!pregameStorageKey) return;
    try {
      window.localStorage.setItem(
        pregameStorageKey,
        JSON.stringify({
          teams: pregameTeams,
          goalkeeperByTeam,
        }),
      );
    } catch {
      // no-op
    }
  }, [pregameStorageKey, pregameTeams, goalkeeperByTeam]);

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
      for (const teamName of pregameTeams) {
        await createTeamForMatch(created.id, teamName);
      }
      await applyDraftToMatch(created.id, {
        lines: draftLines.map((line) => ({
          teamName: line.teamName,
          slots: [
            {
              userId: goalkeeperByTeam[line.teamName],
              goalkeeper: true,
            },
            ...line.players.map((slot) => ({ userId: slot.userId, goalkeeper: false })),
          ],
        })),
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
    setDraftLines([]);
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
    setDraftLines([]);
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
    setGoalkeeperByTeam((prev) => ({ ...prev, [teamName]: pick }));
    appToast.success('Goleiro definido para a equipe.');
  }

  function clearGoalkeeperForTeam(teamName: string) {
    setGoalkeeperByTeam((prev) => {
      const out = { ...prev };
      delete out[teamName];
      return out;
    });
    setDraftLines([]);
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
      const result = await runDraft(peladaId, {
        date: presenceDateForDraft,
        teamNames: pregameTeams,
        goalkeeperUserIds: selectedGoalkeeperIds,
      });
      setDraftLines(result);
      appToast.success('Times sorteados.');
    } catch {
      appToast.error('Falha ao sortear times.');
    } finally {
      setRunningDraft(false);
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
                      const gkId = goalkeeperByTeam[name];
                      const gkName = draftPeladaUsers.find((u) => u.id === gkId)?.name ?? '—';
                      const drafted = draftedPlayersByTeam.get(name) ?? [];
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
                            {drafted.map((playerName) => (
                              <li key={`${name}-${playerName}`} className={s.rosterRow}>
                                <span className={s.rosterName}>{playerName}</span>
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
                                {presentUsersSorted.map((u) => (
                                  <option key={`${name}-${u.id}`} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button type="button" className={s.btn} onClick={() => defineGoalkeeperForTeam(name)}>
                              Definir goleiro
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
      <ul className={s.matchList}>
        {matches.map((m) => (
          <li key={m.id} className={s.matchItem}>
            <Link to={`/matches/${m.id}`} className={s.matchLink}>
              <span className={s.matchId}>#{m.id}</span>
              {m.finishedAt && <span className={s.matchFinishedTag}>Encerrada</span>}
              <span className={s.matchMeta}>{new Date(m.date).toLocaleString('pt-BR')}</span>
              <span className={s.matchMeta}>{m.location}</span>
              <span className={s.matchPlacar}>{formatMatchPlacar(m.teamScores)}</span>
              <span className={s.matchChevron}>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
