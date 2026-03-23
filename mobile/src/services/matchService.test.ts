import { formatMatchPlacar } from '@/services/matchService';

describe('formatMatchPlacar', () => {
  it('retorna texto padrão sem scores', () => {
    expect(formatMatchPlacar(null)).toBe('Sem equipes ou placar ainda');
  });

  it('formata duelo entre dois times', () => {
    expect(
      formatMatchPlacar([
        { teamId: 1, teamName: 'X', goals: 0 },
        { teamId: 2, teamName: 'Y', goals: 0 },
      ]),
    ).toBe('X 0 × 0 Y');
  });
});
