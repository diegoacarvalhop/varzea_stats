import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmModal.module.scss';

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo vermelho para ações destrutivas */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className={styles.title}>
          {title}
        </h2>
        <p id="confirm-modal-desc" className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? styles.btnDanger : styles.btnConfirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
