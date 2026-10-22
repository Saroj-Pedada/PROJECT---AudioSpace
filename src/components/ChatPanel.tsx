import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, Timer } from 'lucide-react';
import { CHAT_MESSAGE_MAX, CHAT_TTL_MS } from '../../shared/validation.ts';
import { errorMessage } from '../lib/api.ts';
import type { LiveMessage } from '../lib/useAudioRoom.ts';
import Avatar from './Avatar.tsx';

const TTL_MINUTES = Math.round(CHAT_TTL_MS / 60000);

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function timeLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}s`;
}

interface ChatPanelProps {
  messages: LiveMessage[];
  selfUserId: number;
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export default function ChatPanel({ messages, selfUserId, onSend, disabled = false, className = '' }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const now = useNow(1000);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      await onSend(text);
      setDraft('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={`glass flex flex-col overflow-hidden rounded-[2rem] ${className}`} aria-label="Disappearing chat">
      <header className="border-b border-white/10 px-5 py-4">
        <h2 className="font-bold">Chat</h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
          <Timer className="size-3.5" /> Messages disappear {TTL_MINUTES} minutes after they're sent
        </p>
      </header>

      <ol ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.length === 0 && (
          <li className="grid h-full place-items-center py-10 text-center text-sm text-white/40">
            Nothing here yet. Say hi; it won't stick around.
          </li>
        )}
        {messages.map(message => {
          const left = message.expiresAt - now;
          const mine = message.userId === selfUserId;
          return (
            <li
              key={message.id}
              className={`flex gap-2.5 transition-opacity duration-1000 ${mine ? 'flex-row-reverse' : ''}`}
              style={{ opacity: left < 30_000 ? 0.35 + (0.65 * left) / 30_000 : 1 }}
            >
              <Avatar seed={message.avatarSeed} size="xs" className="mt-5" />
              <div className={`min-w-0 max-w-[80%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
                <span className="mb-1 flex items-center gap-1.5 text-[11px] text-white/45">
                  {!mine && <span className="truncate font-semibold text-white/70">{message.name}</span>}
                  <span className="flex shrink-0 items-center gap-0.5" title="Time until this message disappears">
                    <Timer className="size-3" /> {timeLeft(left)}
                  </span>
                </span>
                <p className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  mine ? 'rounded-tr-md bg-accent-strong text-white' : 'rounded-tl-md bg-white/10'
                }`}>
                  {message.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <form onSubmit={onSubmit} className="border-t border-white/10 p-3">
        {error && <p role="alert" className="px-2 pb-2 text-xs font-medium text-live">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={CHAT_MESSAGE_MAX}
            disabled={disabled}
            placeholder={disabled ? 'Join the room to chat' : 'Send a disappearing message…'}
            aria-label="Message"
            className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/25 px-4 text-sm outline-none transition placeholder:text-white/35 focus:border-accent focus:ring-4 focus:ring-accent/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || sending || !draft.trim()}
            aria-label="Send message"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-accent-strong transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4.5" />
          </button>
        </div>
      </form>
    </section>
  );
}
