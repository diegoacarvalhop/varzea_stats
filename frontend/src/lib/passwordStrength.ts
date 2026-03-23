export type PasswordStrength = 'none' | 'weak' | 'medium' | 'strong';

/**
 * Heurística simples: comprimento, variedade de caracteres (min/mai/número/símbolo).
 * Alinhado ao mínimo de 6 caracteres do backend; "forte" exige combinação mais segura.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'none';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score === 3) return 'medium';
  return 'strong';
}

export function passwordStrengthLabel(s: PasswordStrength): string {
  switch (s) {
    case 'none':
      return '';
    case 'weak':
      return 'Fraca';
    case 'medium':
      return 'Média';
    case 'strong':
      return 'Forte';
    default:
      return '';
  }
}
