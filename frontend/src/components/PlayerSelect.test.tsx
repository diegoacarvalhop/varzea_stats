import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerSelect } from '@/components/PlayerSelect';
import type { PlayerDirectoryEntry } from '@/services/playerService';

const entries: PlayerDirectoryEntry[] = [
  {
    playerId: 10,
    playerName: 'Ana',
    teamName: 'T1',
    matchId: 1,
    matchDate: null,
    matchLocation: null,
    goalkeeper: false,
  },
];

describe('PlayerSelect', () => {
  it('lista jogadores e chama onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PlayerSelect
        id="ps"
        label="Jogador"
        value=""
        onChange={onChange}
        entries={entries}
        loading={false}
      />,
    );

    expect(screen.getByRole('combobox', { name: /Jogador/ })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /Jogador/ }));
    await user.click(screen.getByRole('option', { name: /Ana/ }));
    expect(onChange).toHaveBeenCalledWith('10');
  });
});
