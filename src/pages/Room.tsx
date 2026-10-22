import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Crown, Link2, Mic, MicOff, MonitorSmartphone, Users, Volume2, WifiOff } from 'lucide-react';
import type { Member, Room as RoomInfo } from '../../shared/protocol.ts';
import { api, ApiError } from '../lib/api.ts';
import { useAudioRoom } from '../lib/useAudioRoom.ts';
import { useSpeaking } from '../lib/useSpeaking.ts';
import AppShell from '../components/AppShell.tsx';
import Avatar from '../components/Avatar.tsx';
import Button, { buttonClasses } from '../components/Button.tsx';
import Spinner from '../components/Spinner.tsx';
import NotFound from './NotFound.tsx';

function useRoomInfo(roomId: string) {
  const [room, setRoom] = useState<RoomInfo | null | undefined>(undefined);
  useEffect(() => {
    api.get<RoomInfo>(`/api/rooms/${roomId}`)
      .then(setRoom)
      .catch(err => setRoom(err instanceof ApiError && err.status === 404 ? null : undefined));
  }, [roomId]);
  return room;
}

interface MemberTileProps {
  member: Member;
  isSelf: boolean;
  isHost: boolean;
  speaking: boolean;
  canModerate: boolean;
  onMute: () => void;
}

function MemberTile({ member, isSelf, isHost, speaking, canModerate, onMute }: MemberTileProps) {
  return (
    <li className="flex animate-rise flex-col items-center text-center">
      <div className="relative">
        <Avatar name={member.name} size="lg" speaking={speaking && !member.muted} />
        {isHost && (
          <span title="Host" className="absolute -top-1 -left-1 grid size-7 place-items-center rounded-full bg-amber-400 text-night-900 shadow-lg ring-3 ring-night-800">
            <Crown className="size-3.5" strokeWidth={2.5} />
          </span>
        )}
        {member.muted && (
          <span title="Muted" className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full bg-night-700 text-white/80 shadow-lg ring-3 ring-night-800">
            <MicOff className="size-3.5" />
          </span>
        )}
      </div>
      <p className="mt-3 w-full truncate text-sm font-semibold" title={member.name}>{member.name}</p>
      <p className="text-xs text-white/40">
        {isSelf && <span className="font-semibold text-accent">You · </span>}
        {isHost ? 'Host' : member.muted ? 'Listening' : 'Speaker'}
      </p>
      {canModerate && !member.muted && (
        <button
          type="button"
          onClick={onMute}
          className="mt-2 cursor-pointer rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-live/50 hover:bg-live/15 hover:text-white"
        >
          Mute
        </button>
      )}
    </li>
  );
}

interface CenteredMessageProps {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}

function CenteredMessage({ icon, title, text, action }: CenteredMessageProps) {
  return (
    <div className="glass mx-auto mt-16 max-w-md rounded-3xl p-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10">{icon}</div>
      <h2 className="mt-5 text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-white/60">{text}</p>
      <div className="flex flex-col items-center gap-1">
        {action}
        <Link to="/rooms" className={buttonClasses(action ? 'ghost' : 'glass', 'md', action ? 'mt-2' : 'mt-7')}>Back to all rooms</Link>
      </div>
    </div>
  );
}

function InviteButton() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="glass" size="sm" onClick={copy}>
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {copied ? 'Link copied' : 'Invite'}
    </Button>
  );
}

function Stage({ roomId, room }: { roomId: string; room: RoomInfo }) {
  const navigate = useNavigate();
  const audio = useAudioRoom(roomId);
  const speaking = useSpeaking(audio.streams);

  useEffect(() => {
    document.title = `${room.name} · AudioSpace`;
    return () => { document.title = 'AudioSpace'; };
  }, [room.name]);

  // Space bar toggles the mic, like push-to-talk apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || (e.target as HTMLElement).closest('input, textarea, button, a')) return;
      e.preventDefault();
      audio.setMuted(!audio.muted);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [audio]);

  if (audio.status === 'full') {
    return <CenteredMessage icon={<Users className="size-6" />} title="This room is full" text={`${room.name} is at capacity right now. Try again in a bit, or pick another room.`} />;
  }
  if (audio.status === 'elsewhere') {
    return (
      <CenteredMessage
        icon={<MonitorSmartphone className="size-6" />}
        title="You joined from another tab"
        text={`You can only be in ${room.name} once, so this tab stepped aside.`}
        action={<Button size="md" className="mt-7" onClick={() => window.location.reload()}>Use this tab instead</Button>}
      />
    );
  }
  if (audio.status === 'error') {
    return <CenteredMessage icon={<WifiOff className="size-6" />} title="Couldn't join the room" text="Your session may have expired. Head back and try again." />;
  }

  const ordered = [...audio.members].sort((a, b) => Number(b.id === audio.hostId) - Number(a.id === audio.hostId));
  const micPending = audio.micState === 'pending';

  return (
    <>
      <section className="glass relative min-h-80 rounded-[2rem] px-5 pt-8 pb-10 sm:px-10">
        {audio.status !== 'live' ? (
          <div className="grid h-64 place-items-center text-center">
            <div className="flex flex-col items-center gap-3 text-sm text-white/60">
              <Spinner className="size-7" />
              {audio.status === 'reconnecting' ? 'Reconnecting…' : 'Joining the room…'}
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-5">
            {ordered.map(member => (
              <MemberTile
                key={member.id}
                member={member}
                isSelf={member.id === audio.selfId}
                isHost={member.id === audio.hostId}
                speaking={speaking.has(member.id)}
                canModerate={audio.isHost && member.id !== audio.selfId}
                onMute={() => audio.muteMember(member.id)}
              />
            ))}
          </ul>
        )}
        {audio.status === 'live' && audio.members.length === 1 && (
          <p className="mt-10 text-center text-sm text-white/50">It's just you for now. Share the invite link to bring friends in.</p>
        )}
      </section>

      {/* Bottom control dock */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl space-y-3">
          {audio.audioBlocked && (
            <button
              type="button"
              onClick={audio.unlockAudio}
              className="glass flex w-full animate-rise cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent-strong/30 px-4 py-3 text-sm font-semibold"
            >
              <Volume2 className="size-4.5" /> Your browser paused the audio. Tap to hear the room.
            </button>
          )}
          {audio.notice && (
            <div className="glass flex animate-rise items-center justify-between gap-3 rounded-2xl bg-night-800/80 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-white/80">
                <MicOff className="size-4 shrink-0" />
                {audio.notice}
              </span>
              <button type="button" onClick={audio.dismissNotice} className="cursor-pointer text-xs font-semibold text-white/60 hover:text-white">Dismiss</button>
            </div>
          )}

          <div className="glass flex items-center justify-between gap-3 rounded-full bg-night-800/80 p-2.5">
            <Button variant="danger" onClick={() => navigate('/rooms')}>
              <span aria-hidden>✌️</span> Leave quietly
            </Button>

            <button
              type="button"
              onClick={() => audio.setMuted(!audio.muted)}
              disabled={micPending || audio.status !== 'live'}
              aria-pressed={!audio.muted}
              aria-label={audio.muted ? 'Unmute microphone' : 'Mute microphone'}
              title={audio.muted ? 'Unmute (Space)' : 'Mute (Space)'}
              className={[
                'grid size-14 cursor-pointer place-items-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
                audio.muted ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-speak text-night-900 shadow-lg shadow-speak/40 hover:brightness-110',
              ].join(' ')}
            >
              {micPending ? <Spinner className="size-6" /> : audio.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>

            <span className="flex min-w-24 items-center justify-end gap-1.5 pr-3 text-sm font-semibold text-white/70">
              <Users className="size-4" /> {audio.members.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Room() {
  const { roomId = '' } = useParams();
  const room = useRoomInfo(roomId);

  if (room === null) return <NotFound />;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-48 sm:px-6 sm:pt-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link to="/rooms" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 transition hover:text-white">
            <ArrowLeft className="size-4" /> All rooms
          </Link>
          {room && <InviteButton />}
        </div>

        {!room ? (
          <div className="grid h-60 place-items-center"><Spinner className="size-7" /></div>
        ) : (
          <>
            <header className="mb-8 flex items-center gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl ring-1 ring-white/10">{room.emoji}</div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{room.name}</h1>
                <p className="mt-0.5 line-clamp-1 text-sm text-white/55">{room.description}</p>
              </div>
            </header>
            <Stage key={roomId} roomId={roomId} room={room} />
          </>
        )}
      </main>
    </AppShell>
  );
}
