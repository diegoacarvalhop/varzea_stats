import { useId, useState } from 'react';
import {
  getPasswordStrength,
  passwordStrengthLabel,
  type PasswordStrength,
} from '@/lib/passwordStrength';
import s from './PasswordField.module.scss';

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M10.7 10.7a2 2 0 0 0 2.6 2.6M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.9 4.2M6.2 6.2A18.3 18.3 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 2 22 22" strokeLinecap="round" />
    </svg>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  /** Barra fraca / média / forte (só faz sentido para campo “nova senha”). */
  showStrengthMeter?: boolean;
};

function strengthSegClass(level: PasswordStrength, index: 0 | 1 | 2): string {
  const base = s.strengthSeg;
  if (level === 'none') return base;
  if (level === 'weak') return index === 0 ? `${base} ${s.strengthSegActiveWeak}` : base;
  if (level === 'medium') return index <= 1 ? `${base} ${s.strengthSegActiveMedium}` : base;
  return `${base} ${s.strengthSegActiveStrong}`;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
  showStrengthMeter = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strengthId = useId();
  const strength = showStrengthMeter ? getPasswordStrength(value) : 'none';

  const strengthLabelClass =
    strength === 'weak'
      ? s.strengthLabelWeak
      : strength === 'medium'
        ? s.strengthLabelMedium
        : strength === 'strong'
          ? s.strengthLabelStrong
          : s.strengthLabelMuted;

  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
        {required && (
          <span className={s.requiredMark} aria-hidden title="Obrigatório">
            *
          </span>
        )}
      </label>
      <div className={s.inputWrap}>
        <input
          id={id}
          className={s.input}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          aria-describedby={showStrengthMeter && value ? strengthId : undefined}
        />
        <button
          type="button"
          className={s.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
      {showStrengthMeter && value.length > 0 && (
        <div className={s.strength} id={strengthId} role="status" aria-live="polite">
          <div className={s.strengthTrack}>
            <div className={strengthSegClass(strength, 0)} />
            <div className={strengthSegClass(strength, 1)} />
            <div className={strengthSegClass(strength, 2)} />
          </div>
          <span className={strengthLabelClass}>
            Força da senha: {passwordStrengthLabel(strength)}
          </span>
        </div>
      )}
    </div>
  );
}
