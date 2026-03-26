/**
 * Dia efetivo de vencimento no mês civil (nunca ultrapassa o último dia do mês).
 * Ex.: vencimento 31 em fevereiro → 28 ou 29.
 */
export function effectiveMonthlyDueDayInMonth(raw: number | null | undefined, date: Date): number {
  const r = raw != null && raw >= 1 && raw <= 31 ? raw : 15;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(r, last);
}
