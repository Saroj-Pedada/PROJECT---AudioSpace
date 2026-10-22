import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Dices } from 'lucide-react';
import type { RoomDetails } from '../../shared/protocol.ts';
import { ROOM_DESCRIPTION_MAX, ROOM_EMOJIS, ROOM_NAME_MAX, isValidPasscode } from '../../shared/validation.ts';
import { api, errorMessage } from '../lib/api.ts';
import Button from './Button.tsx';
import Field, { inputClasses } from './Field.tsx';
import Modal from './Modal.tsx';
import Spinner from './Spinner.tsx';

function randomPasscode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}

export default function CreateRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [emoji, setEmoji] = useState(ROOM_EMOJIS[0]);
  const [passcode, setPasscode] = useState(randomPasscode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const { room } = await api.post<RoomDetails>('/api/rooms', {
        name: form.get('name'),
        description: form.get('description'),
        emoji,
        passcode,
      });
      onClose();
      navigate(`/rooms/${room.id}`, { state: { justCreated: true } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New private room" subtitle="Only people with the link and passcode can join.">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold tracking-wider text-white/60 uppercase">Icon</span>
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Room icon">
            {ROOM_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                onClick={() => setEmoji(e)}
                className={`grid aspect-square cursor-pointer place-items-center rounded-xl text-xl transition ${
                  emoji === e ? 'bg-accent-strong/40 ring-2 ring-accent' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <Field label="Room name" name="name" required maxLength={ROOM_NAME_MAX} placeholder="Friday night hangout" autoFocus />
        <Field label="Description (optional)" name="description" maxLength={ROOM_DESCRIPTION_MAX} placeholder="What's this room about?" />

        <div className="space-y-1.5">
          <label htmlFor="room-passcode" className="text-xs font-semibold tracking-wider text-white/60 uppercase">6-digit passcode</label>
          <div className="flex gap-2">
            <input
              id="room-passcode"
              inputMode="numeric"
              autoComplete="off"
              value={passcode}
              onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputClasses} font-mono text-lg tracking-[0.5em]`}
              aria-invalid={!isValidPasscode(passcode)}
            />
            <Button variant="glass" className="h-12 px-4" onClick={() => setPasscode(randomPasscode())} title="Generate a new passcode">
              <Dices className="size-5" />
            </Button>
          </div>
          <p className="text-xs text-white/50">Share it with friends along with the room link. You can always see it from the room.</p>
        </div>

        <p role="alert" className="min-h-5 text-sm font-medium text-live">{error}</p>

        <Button type="submit" size="lg" className="w-full" disabled={busy || !isValidPasscode(passcode)}>
          {busy ? <Spinner /> : 'Create room'}
        </Button>
      </form>
    </Modal>
  );
}
