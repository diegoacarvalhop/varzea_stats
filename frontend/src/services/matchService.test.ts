import { describe, expect, it } from 'vitest';
import { formatMatchPlacar } from '@/services/matchService';

describe('formatMatchPlacar', () => {
  it('sem placar', () => {
    expect(formatMatchPlacar(undefined)).toBe('Sem equipes ou placar ainda');
    expect(formatMatchPlacar([])).toBe('Sem equipes ou placar ainda');
  });

  it('dois times', () => {
    expect(
      formatMatchPlacar([
        { teamId: 1, teamName: 'A', goals: 2 },
        { teamId: 2, teamName: 'B', goals: 1 },
      ]),
    ).toBe('A 2 × 1 B');
  });

  it('mais de dois times', () => {
    expect(
      formatMatchPlacar([
        { teamId: 1, teamName: 'A', goals: 1 },
        { teamId: 2, teamName: 'B', goals: 0 },
        { teamId: 3, teamName: 'C', goals: 3 },
      ]),
    ).toBe('A 1 · B 0 · C 3');
  });
});
