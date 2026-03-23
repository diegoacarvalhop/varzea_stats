import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
import { createTeamForMatch, listTeamsByMatch, type Team } from '@/services/teamService';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MatchMediaGallery } from '@/components/MatchMediaGallery';
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect';
import { useAuth } from '@/hooks/useAuth';
import { appToast } from '@/lib/appToast';
import {
  EVENT_RECORDER_ROLES,
  hasAnyRole,
  MATCH_MANAGER_ROLES,
  ROSTER_EDITOR_ROLES,
} from '@/lib/roles';
import s from '@/styles/pageShared.module.scss';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'GOAL', label: 'Gol' },
  { value: 'ASSIST', label: 'Assistência' },
  { value: 'YELLOW_CARD', label: 'Cartão amarelo' },
  { value: 'RED_CARD', label: 'Cartão vermelho' },
  { value: 'BLUE_CARD', label: 'Cartão azul' },
  { value: 'FOUL', label: 'Falta' },
  { value: 'SUBSTITUTION', label: 'Substituição' },
  { value: 'OTHER', label: 'Outro' },
];

const EVENT_LABELS: Record<EventType, string> = Object.fromEntries(
  EVENT_TYPES.map((x) => [x.value, x.label]),
) as Record<EventType, string>;

function groupDirectoryForRoster(entries: PlayerDirectoryEntry[], currentMatchId: number) {
  const map = new Map<string, PlayerDirectoryEntry[]>();
  for (const e of entries) {
    const teamPart = e.teamName?.trim() || 'Equipe';
    const matchPart =
      e.matchId === currentMatchId ? 'esta partida' : `Partida #${e.matchId ?? '?'}`;
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
  const [removePlayerConfirm, setRemovePlayerConfirm] = useState<Player | null>(null);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [playerDirectory, setPlayerDirectory] = useState<PlayerDirectoryEntry[]>([]);

  const [newTeamName, setNewTeamName] = useState('');
  const [playerNamesByTeam, setPlayerNamesByTeam] = useState<Record<number, string>>({});
  const [playerGoalkeeperByTeam, setPlayerGoalkeeperByTeam] = useState<Record<number, boolean>>({});

  const [eventType, setEventType] = useState<EventType>('GOAL');
  const [eventPlayerId, setEventPlayerId] = useState('');
  const [eventTargetId, setEventTargetId] = useState('');
  const [finishing, setFinishing] = useState(false);

  const matchFinished = Boolean(match?.finishedAt);
  const effectiveCanRoster = canRoster && !matchFinished;

  const rosterDirectoryGroups = useMemo(
    () => groupDirectoryForRoster(playerDirectory, matchId),
    [playerDirectory, matchId],
  );

  const eventMainPlayer = useMemo(() => {
    if (!eventPlayerId) return null;
    const id = Number(eventPlayerId);
    if (!Number.isFinite(id)) return null;
    return players.find((p) => p.id === id) ?? null;
  }, [eventPlayerId, players]);

  const targetPlayerOptions = useMemo(() => {
    if (eventType !== 'FOUL') return players;
    if (!eventMainPlayer) return [];
    return players.filter((p) => p.teamId !== eventMainPlayer.teamId);
  }, [eventType, eventMainPlayer, players]);

  useEffect(() => {
    if (eventType !== 'FOUL' || !eventTargetId) return;
    const tid = Number(eventTargetId);
    if (!Number.isFinite(tid)) return;
    const ok = targetPlayerOptions.some((p) => p.id === tid);
    if (!ok) setEventTargetId('');
  }, [eventType, eventTargetId, targetPlayerOptions]);

  const directorySelectOptions = useMemo(() => {
    const out: SearchableSelectOption[] = [];
    for (const g of rosterDirectoryGroups) {
      for (const e of g.entries) {
        out.push({
          value: `${e.playerId}:${e.matchId ?? ''}`,
          label: `${e.playerName}${e.goalkeeper ? ' (Goleiro)' : ''}`,
          group: g.label,
        });
      }
    }
    return out;
  }, [rosterDirectoryGroups]);

  const eventTypeSelectOptions = useMemo(
    () => EVENT_TYPES.map((x) => ({ value: x.value, label: x.label })),
    [],
  );

  const eventPlayerSelectOptions = useMemo(() => buildPlayerOptionsByTeam(players, teams), [players, teams]);

  const targetPlayerSelectOptions = useMemo(
    () => buildPlayerOptionsByTeam(targetPlayerOptions, teams),
    [targetPlayerOptions, teams],
  );

  const refresh = useCallback(async () => {
    if (!Number.isFinite(matchId)) return;
    const [m, t, p, e, dir] = await Promise.all([
      getMatch(matchId),
      listTeamsByMatch(matchId),
      listPlayersByMatch(matchId),
      listEventsByMatch(matchId),
      listPlayersDirectory().catch(() => [] as PlayerDirectoryEntry[]),
    ]);
    setMatch(m);
    setTeams(t);
    setPlayers(p);
    setEvents(e);
    setPlayerDirectory(dir);
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

  async function onCreateTeam(e: FormEvent) {
    e.preventDefault();
    try {
      await createTeamForMatch(matchId, newTeamName.trim());
      setNewTeamName('');
      appToast.success('Equipe criada nesta partida.');
      await refresh();
    } catch {
      appToast.error('Falha ao criar equipe (administrador ou SCOUT).');
    }
  }

  async function onCreatePlayer(e: FormEvent, teamId: number) {
    e.preventDefault();
    const name = (playerNamesByTeam[teamId] ?? '').trim();
    if (!name) {
      appToast.warning('Informe o nome do jogador.');
      return;
    }
    try {
      const isGk = playerGoalkeeperByTeam[teamId] ?? false;
      await createPlayerForMatch(matchId, teamId, name, isGk);
      setPlayerNamesByTeam((prev) => ({ ...prev, [teamId]: '' }));
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
          <h1>Partida #{match.id}</h1>
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

      {match && <MatchMediaGallery items={mediaItems} />}

      <div className={s.card}>
        <h2 className={s.cardTitle}>1. Equipes desta partida</h2>
        <p className={s.lead} style={{ marginBottom: '1rem' }}>
          Cada equipe existe só neste jogo. Marque o <strong>goleiro</strong>; ele aparece primeiro na lista. Use{' '}
          <strong>Remover</strong> para substituições (lances antigos permanecem, sem vínculo com o jogador).
        </p>
        {effectiveCanRoster && (
          <form className={s.formInline} style={{ marginBottom: '1.5rem' }} onSubmit={onCreateTeam}>
            <div className={s.field} style={{ flex: '1 1 220px' }}>
              <label className={s.fieldLabel} htmlFor="new-team-name">
                Nova equipe
                <span className={s.requiredMark} aria-hidden>
                  *
                </span>
              </label>
              <input
                id="new-team-name"
                className={s.input}
                value={newTeamName}
                onChange={(ev) => setNewTeamName(ev.target.value)}
                placeholder="Ex.: Time da esquerda"
                required
              />
            </div>
            <button className={s.btnPrimary} type="submit">
              Adicionar equipe
            </button>
          </form>
        )}
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
                    label="Jogador já cadastrado na pelada"
                    value=""
                    aria-label="Preencher nome a partir de um jogador já cadastrado na pelada (inclui esta partida)"
                    options={directorySelectOptions}
                    emptyOption={{
                      value: '',
                      label:
                        rosterDirectoryGroups.length === 0
                          ? '— Nenhum jogador cadastrado na pelada —'
                          : '— Escolher da lista para preencher o nome —',
                    }}
                    onChange={(v) => {
                      if (!v) return;
                      const sep = v.indexOf(':');
                      const pid = sep >= 0 ? v.slice(0, sep) : v;
                      const mid = sep >= 0 ? v.slice(sep + 1) : '';
                      const entry = playerDirectory.find(
                        (x) =>
                          String(x.playerId) === pid &&
                          String(x.matchId ?? '') === (mid || String(x.matchId ?? '')),
                      );
                      if (entry) {
                        setPlayerNamesByTeam((prev) => ({ ...prev, [team.id]: entry.playerName }));
                        setPlayerGoalkeeperByTeam((prev) => ({
                          ...prev,
                          [team.id]: entry.goalkeeper,
                        }));
                      }
                    }}
                  />
                  <div className={s.field}>
                    <label className={s.fieldLabel} htmlFor={`player-name-${team.id}`}>
                      Nome do jogador
                      <span className={s.requiredMark} aria-hidden>
                        *
                      </span>
                    </label>
                    <input
                      id={`player-name-${team.id}`}
                      className={s.input}
                      placeholder="Ex.: João"
                      value={playerNamesByTeam[team.id] ?? ''}
                      onChange={(ev) =>
                        setPlayerNamesByTeam((prev) => ({ ...prev, [team.id]: ev.target.value }))
                      }
                      required
                    />
                  </div>
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
                  <button className={s.btn} type="submit">
                    Adicionar jogador
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={s.card}>
        <h2 className={s.cardTitle}>2. Lances (stats) desta partida</h2>
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
              label={
                eventType === 'FOUL'
                  ? 'Quem sofreu a falta (somente time adversário ao infrator)'
                  : 'Jogador alvo (opcional)'
              }
              value={eventTargetId}
              onChange={setEventTargetId}
              options={targetPlayerSelectOptions}
              disabled={eventType === 'FOUL' && !eventMainPlayer}
              emptyOption={{
                value: '',
                label:
                  eventType === 'FOUL' && !eventMainPlayer
                    ? '— Selecione o infrator primeiro —'
                    : '— Nenhum —',
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
        {events.length === 0 ? (
          <p className={s.lead}>Nenhum lance registrado ainda.</p>
        ) : (
          <ul className={s.timeline}>
            {events.map((ev) => (
              <li key={ev.id} className={s.timelineItem}>
                <span className={s.timelineId}>#{ev.id}</span>
                {eventLine(ev)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={s.card}>
        <h2 className={s.cardTitle}>3. Encerrar partida</h2>
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
