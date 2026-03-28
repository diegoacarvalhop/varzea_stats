/**
 * Duração no formato HH:MM:SS (para <input type="time" step="1"> ou texto).
 */

/** Exibe segundos como HH:MM:SS (sempre com horas). */
export function formatSecondsAsHms(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Valor para input type="time" (até 23:59:59).
 * Valores maiores saturam (caso raro).
 */
export function secondsToHmsDurationValue(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 23) {
    return '23:59:59';
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Interpreta HH:MM:SS ou HH:MM como duração (horas, minutos, segundos).
 * Vazio → null.
 */
export function hmsDurationValueToSeconds(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  const secs = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || !Number.isFinite(secs)) {
    return null;
  }
  if (mins < 0 || mins > 59 || secs < 0 || secs > 59 || hours < 0) {
    return null;
  }
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : null;
}
