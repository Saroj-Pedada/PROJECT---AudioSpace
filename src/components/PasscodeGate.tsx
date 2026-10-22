import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Lock } from 'lucide-react';
import type { Room } from '../../shared/protocol.ts';
import { api, errorMessage } from '../lib/api.ts';
import Button from './Button.tsx';
import Spinner from './Spinner.tsx';

const LENGTH = 6;

/** Six single-digit boxes, with paste and backspace handling like a one-time-code field. */
export default function PasscodeGate({ room, onUnlocked }: { room: Room; onUnlocked: () => void }) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function setFrom(index: number, value: string) {
    const incoming = value.replace(/\D/g, '').split('');
    if (incoming.length === 0) return;
    setDigits(prev => {
      const next = [...prev];
      incoming.slice(0, LENGTH - index).forEach((d, i) => { next[index + i] = d; });
      return next;
    });
    inputs.current[Math.min(index + incoming.length, LENGTH - 1)]?.focus();
    setError('');
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigits(prev => prev.map((d, i) => (i === index - 1 ? '' : d)));
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function onPaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    setFrom(index, e.clipboardData.getData('text'));
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    const passcode = digits.join('');
    if (passcode.length !== LENGTH) return;
    setBusy(true);
    try {
      await api.post(`/api/rooms/${room.id}/unlock`, { passcode });
      onUnlocked();
    } catch (err) {
      setError(errorMessage(err));
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
      setBusy(false);
    }
  }

  const complete = digits.every(Boolean);

  return (
    <form onSubmit={onSubmit} className="glass mx-auto mt-6 max-w-md animate-rise rounded-3xl p-8 text-center sm:p-10">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/20 text-accent ring-1 ring-accent/30">
        <Lock className="size-6" />
      </div>
      <h2 className="mt-5 text-xl font-bold">This room is private</h2>
      <p className="mt-2 text-sm text-white/60">
        Enter the 6-digit passcode {room.ownerName ? <>from <strong className="text-white/80">{room.ownerName}</strong></> : 'you were given'} to join.
      </p>

      <div className="mt-7 flex justify-center gap-2 sm:gap-2.5">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={el => { inputs.current[i] = el; }}
            value={digit}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1}`}
            onChange={e => setFrom(i, e.target.value.slice(-1))}
            onKeyDown={e => onKeyDown(i, e)}
            onPaste={e => onPaste(i, e)}
            onFocus={e => e.target.select()}
            className={`h-14 w-11 rounded-xl border bg-black/25 text-center font-mono text-2xl font-bold transition outline-none focus:border-accent focus:ring-4 focus:ring-accent/20 sm:w-12 ${
              error ? 'border-live/60' : 'border-white/15'
            }`}
          />
        ))}
      </div>

      <p role="alert" className="mt-4 min-h-5 text-sm font-medium text-live">{error}</p>

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={!complete || busy}>
        {busy ? <Spinner /> : 'Join room'}
      </Button>
    </form>
  );
}
