/**
 * Valor para <input type="time"> interpretado como duração (horas:minutos), não relógio.
 * Ex.: 90 min → "01:30", 45 min → "00:45".
 */
export function minutesToDurationTimeValue(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 23) {
    // type="time" só aceita até 23:59; valores maiores saturam (caso raro)
    return '23:59';
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Interpreta o valor do input (HH:mm) como duração em minutos. Vazio → null. */
export function durationTimeValueToMinutes(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || mins < 0 || mins > 59 || hours < 0) {
    return null;
  }
  const total = hours * 60 + mins;
  return total > 0 ? total : null;
}
