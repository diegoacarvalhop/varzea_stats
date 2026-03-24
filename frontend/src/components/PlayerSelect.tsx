import {
  formatPlayerDirectoryLabel,
  type PlayerDirectoryEntry,
} from '@/services/playerService';
import { SearchableSelect } from '@/components/SearchableSelect';
import s from '@/styles/pageShared.module.scss';

type PlayerSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (playerId: string) => void;
  entries: PlayerDirectoryEntry[];
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  labelMode?: 'full' | 'nameOnly';
};

export function PlayerSelect({
  id,
  label,
  value,
  onChange,
  entries,
  loading = false,
  disabled = false,
  required = true,
  labelMode = 'full',
}: PlayerSelectProps) {
  const options =
    labelMode === 'nameOnly'
      ? (() => {
          const byName = new Map<string, { playerId: number; playerName: string }>();
          for (const p of entries) {
            const key = p.playerName.trim().toLocaleLowerCase('pt-BR');
            if (!key) continue;
            if (!byName.has(key)) {
              byName.set(key, { playerId: p.playerId, playerName: p.playerName.trim() });
            }
          }
          return [...byName.values()]
            .sort((a, b) => a.playerName.localeCompare(b.playerName, 'pt-BR'))
            .map((p) => ({
              value: String(p.playerId),
              label: p.playerName,
            }));
        })()
      : entries.map((p) => ({
          value: String(p.playerId),
          label: formatPlayerDirectoryLabel(p),
        }));

  return (
    <SearchableSelect
      id={id}
      style={{ flex: '1 1 260px', maxWidth: 'min(100%, 520px)' }}
      label={
        <>
          {label}
          {required && (
            <span className={s.requiredMark} aria-hidden title="Obrigatório">
              *
            </span>
          )}
        </>
      }
      value={value}
      onChange={onChange}
      options={options}
      emptyOption={{
        value: '',
        label: loading ? 'Carregando jogadores…' : 'Selecione um jogador',
      }}
      disabled={disabled || loading}
      required={required}
    />
  );
}
