import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ConfirmModal } from '@/components/ConfirmModal';

describe('ConfirmModal', () => {
  it('não renderiza quando fechado', () => {
    const { container } = render(
      <ConfirmModal
        open={false}
        title="T"
        message="M"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('exibe título e mensagem', () => {
    render(
      <ConfirmModal
        open
        title="Finalizar"
        message="Confirma?"
        confirmLabel="Sim"
        cancelLabel="Não"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = document.body.querySelector('[role="alertdialog"]');
    expect(dialog).toBeTruthy();
    const scope = within(dialog as HTMLElement);
    expect(scope.getByText('Finalizar')).toBeInTheDocument();
    expect(scope.getByText('Confirma?')).toBeInTheDocument();
  });

  it('cancelar chama onCancel', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        open
        title="T"
        message="M"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirmar chama onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        open
        title="T"
        message="M"
        confirmLabel="OK"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
