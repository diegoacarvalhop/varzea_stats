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
}: PlayerSelectProps) {
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
      options={entries.map((p) => ({
        value: String(p.playerId),
        label: formatPlayerDirectoryLabel(p),
      }))}
      emptyOption={{
        value: '',
        label: loading ? 'Carregando jogadores…' : 'Selecione um jogador',
      }}
      disabled={disabled || loading}
      required={required}
    />
  );
}
