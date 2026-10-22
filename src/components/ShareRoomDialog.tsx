import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { Room } from '../../shared/protocol.ts';
import Button from './Button.tsx';
import Modal from './Modal.tsx';

interface ShareRoomDialogProps {
  open: boolean;
  onClose: () => void;
  room: Room;
  passcode: string;
}

function CopyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold tracking-wider text-white/60 uppercase">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 py-1.5 pr-1.5 pl-4">
        <span className={`min-w-0 flex-1 truncate ${mono ? 'font-mono text-xl tracking-[0.4em]' : 'text-sm'}`}>{value}</span>
        <button
          type="button"
          onClick={copy}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="size-4 text-speak" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ShareRoomDialog({ open, onClose, room, passcode }: ShareRoomDialogProps) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/rooms/${room.id}`;
  const invite = `Join me in "${room.name}" on AudioSpace 🎧\n${link}\nPasscode: ${passcode}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(invite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite friends" subtitle="They'll need both the link and the passcode.">
      <div className="space-y-4">
        <CopyRow label="Room link" value={link} />
        <CopyRow label="Passcode" value={passcode} mono />
        <Button size="lg" className="mt-2 w-full" onClick={copyInvite}>
          {copied ? <Check className="size-4.5" /> : <Copy className="size-4.5" />}
          {copied ? 'Invite copied' : 'Copy invite message'}
        </Button>
      </div>
    </Modal>
  );
}
