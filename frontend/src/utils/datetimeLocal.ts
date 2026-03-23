/** Valor para `input type="datetime-local"` no fuso do navegador (mesmo relógio da máquina). */
export function toDatetimeLocalString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Interpreta o valor do datetime-local como data/hora local e devolve ISO UTC para a API (`Instant`).
 */
export function fromDatetimeLocalToUtcIso(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) {
    throw new Error('Data/hora inválida');
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const min = Number(m[5]);
  const local = new Date(y, mo - 1, d, h, min, 0, 0);
  return local.toISOString();
}
