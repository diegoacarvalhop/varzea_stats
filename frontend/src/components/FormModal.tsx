import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './FormModal.module.scss';

const TITLE_ID = 'form-modal-title';

export type FormModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Impede fechar por overlay ou Escape (ex.: durante envio). */
  closeDisabled?: boolean;
  children: ReactNode;
};

export function FormModal({ open, title, onClose, closeDisabled = false, children }: FormModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, closeDisabled]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => !closeDisabled && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && !closeDisabled && onClose()}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={TITLE_ID} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
