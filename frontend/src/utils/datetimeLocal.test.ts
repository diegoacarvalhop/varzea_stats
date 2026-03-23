import { describe, expect, it } from 'vitest';
import { fromDatetimeLocalToUtcIso, toDatetimeLocalString } from '@/utils/datetimeLocal';

describe('datetimeLocal', () => {
  it('toDatetimeLocalString formata data fixa', () => {
    const d = new Date(2025, 2, 21, 14, 7, 0);
    expect(toDatetimeLocalString(d)).toBe('2025-03-21T14:07');
  });

  it('fromDatetimeLocalToUtcIso gera ISO', () => {
    const iso = fromDatetimeLocalToUtcIso('2025-06-15T10:30');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('fromDatetimeLocalToUtcIso rejeita valor inválido', () => {
    expect(() => fromDatetimeLocalToUtcIso('')).toThrow('Data/hora inválida');
  });
});
