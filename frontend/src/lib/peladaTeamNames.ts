import type { Pelada } from '@/services/peladaService';

/** Mesma regra do backend (`DraftService.parseTeamNames`): linhas, vírgulas ou ponto e vírgula. */
export function parsePeladaTeamNames(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(/[\n,;]+/)) {
    const t = part.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Nomes disponíveis para adicionar à partida: configurados na pelada ou "Equipe 1…N" pelo teamCount,
 * excluindo equipes já criadas nesta partida.
 */
export function buildMatchTeamNameChoices(pelada: Pelada | null, existingTeams: { name: string }[]): string[] {
  if (pelada == null) return [];
  const parsed = parsePeladaTeamNames(pelada.teamNames);
  const tc =
    pelada.teamCount != null && Number.isFinite(pelada.teamCount) && pelada.teamCount >= 2
      ? Math.floor(pelada.teamCount)
      : 4;
  const names =
    parsed.length > 0 ? parsed : Array.from({ length: tc }, (_, i) => `Equipe ${i + 1}`);
  const used = new Set(existingTeams.map((t) => t.name.trim().toLowerCase()));
  return names.filter((n) => !used.has(n.trim().toLowerCase()));
}
