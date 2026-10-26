'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from './ui';

/**
 * Explicit confirmation for destructive or irreversible actions (cancel a
 * class, unpublish, deactivate, rotate a QR…). Escape / backdrop = cancel.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = true,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="confirm-title">
      <div className="modal-body">
        <h2 id="confirm-title">{title}</h2>
        {children}
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Annuler
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
