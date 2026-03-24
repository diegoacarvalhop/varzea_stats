const BRL_PREFIX = 'R$ ';

/** Máscara BRL enquanto digita: centavos como dígitos → "R$ 1.234,56". */
export function maskCurrencyBRInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const n = Number(digits) / 100;
  const formatted = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${BRL_PREFIX}${formatted}`;
}

/** Converte centavos armazenados no backend para o texto mascarado. */
export function centsToMasked(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '';
  return maskCurrencyBRInput(String(Math.round(cents)));
}

/** Interpreta string mascarada como centavos (inteiro). Vazio → null. */
export function parseMaskedMoneyToCents(masked: string): number | null {
  const digits = masked.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}
