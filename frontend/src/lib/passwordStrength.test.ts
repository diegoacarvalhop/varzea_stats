import { describe, expect, it } from 'vitest';
import { getPasswordStrength, passwordStrengthLabel } from './passwordStrength';

describe('getPasswordStrength', () => {
  it('retorna none para vazio', () => {
    expect(getPasswordStrength('')).toBe('none');
  });

  it('curta ou pouca variedade é weak', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
    expect(getPasswordStrength('abcdefgh')).toBe('weak');
  });

  it('combinações intermediárias são medium', () => {
    expect(getPasswordStrength('Abcd1234')).toBe('medium');
  });

  it('longa e variada é strong', () => {
    expect(getPasswordStrength('Abcd1234!x')).toBe('strong');
  });

  it('só letras longa pode ser medium com maiúsculas', () => {
    expect(getPasswordStrength('Abcdefghijkl')).toBe('medium');
  });
});

describe('passwordStrengthLabel', () => {
  it('rotula em português', () => {
    expect(passwordStrengthLabel('weak')).toBe('Fraca');
    expect(passwordStrengthLabel('medium')).toBe('Média');
    expect(passwordStrengthLabel('strong')).toBe('Forte');
  });
});
