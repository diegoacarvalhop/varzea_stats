import { api } from '@/services/api';
import type { Player } from '@/services/playerService';

export interface TeamScore {
  teamId: number;
  teamName: string;
  goals: number;
}

export interface Match {
  id: number;
  date: string;
  location: string;
  finishedAt?: string | null;
  /** Preenchido quando a partida foi cancelada (não vale como encerramento normal). */
  cancelledAt?: string | null;
  peladaId?: number;
  /** Confronto do placar (persistido no servidor). */
  focusTeamAId?: number | null;
  focusTeamBId?: number | null;
  teamScores?: TeamScore[];
  /** Listagem: só confronto; detalhe (`GET /matches/:id`): elenco completo. */
  players?: Player[];
}

function numOrUndef(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza instantes vindos como string ISO, número (epoch) ou chaves snake_case / aninhadas. */
function normalizeInstant(v: unknown): string | null | undefined {
  if (v == null) return undefined;
  if (v === '') return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v;
    return new Date(ms).toISOString();
  }
  if (typeof v === 'object' && v !== null && 'epochSecond' in v) {
    const o = v as { epochSecond?: number; nano?: number };
    if (typeof o.epochSecond === 'number') {
      const ms = o.epochSecond * 1000 + (typeof o.nano === 'number' ? Math.floor(o.nano / 1_000_000) : 0);
      return new Date(ms).toISOString();
    }
  }
  return undefined;
}

function normalizeTeamScores(raw: unknown): TeamScore[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item) => {
    const x = item as Record<string, unknown>;
    return {
      teamId: Number(x.teamId ?? x.team_id ?? 0),
      teamName: String(x.teamName ?? x.team_name ?? ''),
      goals: Number(x.goals ?? 0),
    };
  });
}

function normalizePlayers(raw: unknown): Player[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((item) => {
      const x = item as Record<string, unknown>;
      return {
        id: Number(x.id ?? x.player_id),
        name: String(x.name ?? x.player_name ?? ''),
        teamId: numOrNull(x.teamId ?? x.team_id),
        teamName:
          x.teamName != null || x.team_name != null
            ? String(x.teamName ?? x.team_name)
            : null,
        goalkeeper: Boolean(x.goalkeeper),
      };
    })
    .filter((p) => Number.isFinite(p.id) && p.id > 0);
}

/**
 * Garante camelCase e tipos estáveis após o JSON (evita lista de votação vazia se vier snake_case ou data não-string).
 */
export function normalizeMatch(raw: unknown): Match {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Resposta de partida inválida.');
  }
  const r = raw as Record<string, unknown>;
  const dateRaw = r.date;
  const playersRaw = r.players ?? r['players'];
  return {
    id: Number(r.id),
    date: typeof dateRaw === 'string' ? dateRaw : dateRaw != null ? String(dateRaw) : '',
    location: typeof r.location === 'string' ? r.location : String(r.location ?? ''),
    finishedAt: normalizeInstant(r.finishedAt ?? r.finished_at) ?? null,
    cancelledAt: normalizeInstant(r.cancelledAt ?? r.cancelled_at) ?? null,
    peladaId: numOrUndef(r.peladaId ?? r.pelada_id),
    focusTeamAId: numOrNull(r.focusTeamAId ?? r.focus_team_a_id),
    focusTeamBId: numOrNull(r.focusTeamBId ?? r.focus_team_b_id),
    teamScores: normalizeTeamScores(r.teamScores ?? r.team_scores),
    players: normalizePlayers(playersRaw),
  };
}

/** Texto legível do placar, ex.: `Time A (2 x 1) Time B` (dois times) ou `T1 (1) · T2 (0) · …` (mais de dois). */
export function formatMatchPlacar(scores: TeamScore[] | undefined | null): string {
  if (!scores?.length) return 'Sem equipes ou placar ainda';
  if (scores.length === 2) {
    const [a, b] = scores;
    return `${a.teamName} (${a.goals} x ${b.goals}) ${b.teamName}`;
  }
  return scores.map((t) => `${t.teamName} (${t.goals})`).join(' · ');
}

/** Monta placar só para o par em foco (ids salvos na API). */
function formatPlacarForFocusIds(m: Match): string | null {
  if (!m.teamScores?.length) return null;
  const aId = m.focusTeamAId;
  const bId = m.focusTeamBId;
  if (aId == null || bId == null || aId === bId) return null;
  const byId = new Map(m.teamScores.map((s) => [s.teamId, s] as const));
  const sa = byId.get(aId);
  const sb = byId.get(bId);
  if (!sa || !sb) return null;
  return formatMatchPlacar([sa, sb]);
}

/** Detalhe da partida: placar do confronto quando `focusTeamAId` / `focusTeamBId` existem. */
export function formatMatchPlacarFromFocus(m: Match | null | undefined): string {
  if (!m?.teamScores?.length) return '';
  return formatPlacarForFocusIds(m) ?? '';
}

/**
 * Placar nas listagens (Jogos, dashboard): usa o confronto salvo na API; se não houver (dados antigos),
 * tenta o par no `localStorage`.
 */
export function formatMatchPlacarForListItem(m: Match): string {
  const fromApi = formatPlacarForFocusIds(m);
  if (fromApi) return fromApi;
  if (!m.teamScores?.length) return '';
  try {
    const raw = window.localStorage.getItem(`match:selected-teams:${m.id}`);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { teamA?: string; teamB?: string };
    const teamA = typeof parsed.teamA === 'string' ? parsed.teamA : '';
    const teamB = typeof parsed.teamB === 'string' ? parsed.teamB : '';
    if (!teamA || !teamB || teamA === teamB) return '';
    const byName = new Map<string, TeamScore>();
    for (const score of m.teamScores) byName.set(score.teamName, score);
    const filtered = [byName.get(teamA), byName.get(teamB)].filter((s): s is TeamScore => s != null);
    if (filtered.length === 0) return '';
    return formatMatchPlacar(filtered);
  } catch {
    return '';
  }
}

export interface OpenMatchPayload {
  match: Match | null;
}

/** Partida em andamento (`finishedAt` nulo), a mais recente criada. */
export async function getCurrentOpenMatch(): Promise<Match | null> {
  const { data } = await api.get<OpenMatchPayload>('/matches/open');
  const m = data.match;
  if (m == null) return null;
  return normalizeMatch(m);
}

export async function listMatches(): Promise<Match[]> {
  const { data } = await api.get<unknown>('/matches');
  if (!Array.isArray(data)) return [];
  return data.map((row) => normalizeMatch(row));
}

/** Partidas encerradas (`finishedAt` preenchido), para vincular mídia. Exclui canceladas. */
export async function listFinishedMatches(): Promise<Match[]> {
  const all = await listMatches();
  return all.filter(
    (m) =>
      m.finishedAt != null &&
      m.finishedAt !== '' &&
      (m.cancelledAt == null || m.cancelledAt === ''),
  );
}

export async function getMatch(id: number): Promise<Match> {
  const { data } = await api.get<unknown>(`/matches/${id}`);
  return normalizeMatch(data);
}

export async function createMatch(body: { date: string; location: string }): Promise<Match> {
  const { data } = await api.post<unknown>('/matches', body);
  return normalizeMatch(data);
}

export async function finishMatch(matchId: number): Promise<Match> {
  const { data } = await api.post<unknown>(`/matches/${matchId}/finish`);
  return normalizeMatch(data);
}

export async function cancelMatch(matchId: number): Promise<Match> {
  const { data } = await api.post<unknown>(`/matches/${matchId}/cancel`);
  return normalizeMatch(data);
}

export async function deleteMatchPermanently(matchId: number): Promise<void> {
  await api.delete(`/matches/${matchId}`);
}

export async function updateMatchFocusTeams(
  matchId: number,
  body: { teamAId: number; teamBId: number } | { teamAId: null; teamBId: null },
): Promise<Match> {
  const { data } = await api.put<unknown>(`/matches/${matchId}/focus-teams`, {
    teamAId: body.teamAId,
    teamBId: body.teamBId,
  });
  return normalizeMatch(data);
}
