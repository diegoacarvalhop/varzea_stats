import { describe, expect, it, vi } from 'vitest';
import { formatPlayerDirectoryLabel, type PlayerDirectoryEntry } from '@/services/playerService';

describe('formatPlayerDirectoryLabel', () => {
  it('monta rótulo com partes disponíveis', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T18:00:00Z'));

    const e: PlayerDirectoryEntry = {
      playerId: 1,
      playerName: 'Zé',
      teamName: 'Time A',
      matchId: 9,
      matchDate: '2025-01-10T20:00:00.000Z',
      matchLocation: 'Campo',
      goalkeeper: true,
    };

    const label = formatPlayerDirectoryLabel(e);
    expect(label).toContain('Zé');
    expect(label).toContain('Time A');
    expect(label).toContain('Partida #9');
    expect(label).toContain('Campo');
    expect(label).toContain('Goleiro');

    vi.useRealTimers();
  });
});
