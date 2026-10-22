import { useState, type ReactNode } from 'react';
import { errorMessage } from '../lib/api.ts';
import Button from './Button.tsx';
import Modal from './Modal.tsx';
import Spinner from './Spinner.tsx';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

export default function ConfirmDialog({ open, onClose, title, body, confirmLabel, onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm leading-relaxed text-white/70">{body}</div>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-live">{error}</p>}
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={confirm} disabled={busy} className="bg-live/80 hover:bg-live">
          {busy ? <Spinner /> : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
