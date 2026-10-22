import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Check, Link2, Lock, MessageCircle, Mic, MicOff, MonitorSmartphone, Trash2, UserPlus, Users, Volume2, WifiOff, X,
} from 'lucide-react';
import type { Room as RoomInfo, RoomDetails } from '../../shared/protocol.ts';
import { api, ApiError } from '../lib/api.ts';
import { useUser } from '../lib/auth.tsx';
import { useAudioRoom } from '../lib/useAudioRoom.ts';
import { useMediaQuery } from '../lib/useMediaQuery.ts';
import { useSpeaking } from '../lib/useSpeaking.ts';
import AppShell from '../components/AppShell.tsx';
import Button, { buttonClasses } from '../components/Button.tsx';
import ChatPanel from '../components/ChatPanel.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import MoonStage, { type StagePerson } from '../components/MoonStage.tsx';
import PasscodeGate from '../components/PasscodeGate.tsx';
import ShareRoomDialog from '../components/ShareRoomDialog.tsx';
import Spinner from '../components/Spinner.tsx';
import NotFound from './NotFound.tsx';

function useRoomDetails(roomId: string) {
  const [details, setDetails] = useState<RoomDetails | null | undefined>(undefined);
  const load = useCallback(() => {
    api.get<RoomDetails>(`/api/rooms/${roomId}`)
      .then(setDetails)
      .catch(err => setDetails(err instanceof ApiError && err.status === 404 ? null : undefined));
  }, [roomId]);
  useEffect(load, [load]);
  return [details, load] as const;
}

interface CenteredMessageProps {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}

function CenteredMessage({ icon, title, text, action }: CenteredMessageProps) {
  return (
    <div className="glass mx-auto mt-10 max-w-md animate-rise rounded-3xl bg-night-900/50 p-10 text-center">
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

function RoomHeader({ room }: { room: RoomInfo }) {
  return (
    <header className="mb-2 text-center">
      {room.kind === 'private' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-bold tracking-wider text-violet-200 uppercase ring-1 ring-accent/40 backdrop-blur">
          <Lock className="size-3" /> Private · hosted by {room.ownerName}
        </span>
      )}
      <h1 className="mt-3 text-3xl font-black tracking-tight [text-shadow:0_4px_30px_rgb(0_0_0/0.6)] sm:text-5xl">{room.name}</h1>
      {room.description && <p className="mx-auto mt-2 max-w-xl text-sm text-white/70 [text-shadow:0_1px_10px_rgb(0_0_0/0.8)] sm:text-base">{room.description}</p>}
    </header>
  );
}

function CopyLinkButton() {
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

function Stage({ room, header, onLocked }: { room: RoomInfo; header: React.ReactNode; onLocked: () => void }) {
  const user = useUser();
  const navigate = useNavigate();
  const audio = useAudioRoom(room.id);
  const speaking = useSpeaking(audio.streams);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const wide = useMediaQuery('(min-width: 1024px)');
  const isPrivate = room.kind === 'private';
  const canModerate = audio.isHost || user.isAdmin || room.ownerId === user.id;

  useEffect(() => {
    document.title = `${room.name} · AudioSpace`;
    return () => { document.title = 'AudioSpace'; };
  }, [room.name]);

  useEffect(() => {
    if (audio.status === 'locked') onLocked();
  }, [audio.status, onLocked]);

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

  useEffect(() => {
    if (chatOpen || wide) setSeen(audio.messages.length);
  }, [chatOpen, wide, audio.messages.length]);
  const unread = Math.max(0, audio.messages.length - seen);

  if (audio.status === 'full') {
    return <CenteredMessage icon={<Users className="size-6" />} title="This room is full" text={`${room.name} is at capacity right now. Try again in a bit.`} />;
  }
  if (audio.status === 'deleted') {
    return <CenteredMessage icon={<Trash2 className="size-6" />} title="This room was deleted" text="Its owner closed it for good. The chat went with it." />;
  }
  if (audio.status === 'elsewhere') {
    return (
      <CenteredMessage
        icon={<MonitorSmartphone className="size-6" />}
        title="You joined from another tab"
        text={`You can only be in ${room.name} once, so this tab stepped aside.`}
        action={<Button className="mt-7" onClick={() => window.location.reload()}>Use this tab instead</Button>}
      />
    );
  }
  if (audio.status === 'error') {
    return <CenteredMessage icon={<WifiOff className="size-6" />} title="Couldn't join the room" text="Your session may have expired. Head back and try again." />;
  }

  const ordered = [...audio.members].sort((a, b) => Number(b.id === audio.hostId) - Number(a.id === audio.hostId));
  const people: StagePerson[] = ordered.map(m => ({
    key: m.id,
    seed: m.avatarSeed,
    name: m.name,
    caption: m.id === audio.selfId ? <span className="font-semibold text-accent">You</span> : m.muted ? 'Listening' : 'Speaking',
    speaking: speaking.has(m.id),
    muted: m.muted,
    host: m.id === audio.hostId,
    admin: m.isAdmin,
    action: canModerate && m.id !== audio.selfId && !m.muted ? (
      <button
        type="button"
        onClick={() => audio.muteMember(m.id)}
        className="mt-1.5 cursor-pointer rounded-full border border-white/20 bg-night-900/60 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 backdrop-blur transition hover:border-live/50 hover:bg-live/20"
      >
        Mute
      </button>
    ) : undefined,
  }));
  const micPending = audio.micState === 'pending';
  const live = audio.status === 'live';

  return (
    <>
      <div className={isPrivate ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]' : ''}>
        <section className="relative min-h-[420px]">
          {header}
          {!live ? (
            <div className="grid h-[420px] place-items-center">
              <div className="flex flex-col items-center gap-3 text-sm text-white/70">
                <Spinner className="size-7" />
                {audio.status === 'reconnecting' ? 'Reconnecting…' : 'Walking up to the ridge…'}
              </div>
            </div>
          ) : (
            <>
              <MoonStage people={people} emoji={room.emoji} />
              {audio.members.length === 1 && (
                <p className="mt-2 text-center text-sm text-white/60 [text-shadow:0_1px_8px_rgb(0_0_0/0.8)]">
                  Just you and the moon. {isPrivate ? 'Share the link and passcode' : 'Share the link'} to bring friends up here.
                </p>
              )}
            </>
          )}
        </section>

        {isPrivate && wide && (
          <ChatPanel
            messages={audio.messages}
            selfUserId={user.id}
            onSend={audio.sendMessage}
            disabled={!live}
            className="sticky top-20 h-[max(360px,calc(100svh-14rem))] bg-night-900/55"
          />
        )}
      </div>

      {/* Mobile chat sheet */}
      {isPrivate && !wide && chatOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-night-950/60 backdrop-blur-sm lg:hidden" onClick={() => setChatOpen(false)}>
          <div className="relative animate-rise" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
              className="absolute top-3.5 right-4 z-10 grid size-9 cursor-pointer place-items-center rounded-full text-white/60 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            <ChatPanel
              messages={audio.messages}
              selfUserId={user.id}
              onSend={audio.sendMessage}
              disabled={!live}
              className="h-[75svh] rounded-b-none bg-night-900/95 pb-[env(safe-area-inset-bottom)]"
            />
          </div>
        </div>
      )}

      {/* Bottom control dock */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl space-y-3">
          {audio.audioBlocked && (
            <button
              type="button"
              onClick={audio.unlockAudio}
              className="glass flex w-full animate-rise cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent-strong/40 px-4 py-3 text-sm font-semibold"
            >
              <Volume2 className="size-4.5" /> Your browser paused the audio. Tap to hear the room.
            </button>
          )}
          {audio.notice && (
            <div className="glass flex animate-rise items-center justify-between gap-3 rounded-2xl bg-night-800/90 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-white/80"><MicOff className="size-4 shrink-0" />{audio.notice}</span>
              <button type="button" onClick={audio.dismissNotice} className="cursor-pointer text-xs font-semibold text-white/60 hover:text-white">Dismiss</button>
            </div>
          )}

          <div className="glass flex items-center justify-between gap-2 rounded-full bg-night-900/75 p-2.5">
            <Button variant="danger" onClick={() => navigate('/rooms')}>
              <span aria-hidden>✌️</span> <span className="hidden sm:inline">Leave quietly</span><span className="sm:hidden">Leave</span>
            </Button>

            <button
              type="button"
              onClick={() => audio.setMuted(!audio.muted)}
              disabled={micPending || !live}
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

            <div className="flex min-w-24 items-center justify-end gap-1">
              {isPrivate && (
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="relative grid size-11 cursor-pointer place-items-center rounded-full text-white/80 transition hover:bg-white/10 lg:hidden"
                  aria-label={`Open chat${unread ? `, ${unread} new` : ''}`}
                >
                  <MessageCircle className="size-5" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 grid min-w-4.5 place-items-center rounded-full bg-live px-1 text-[10px] font-bold">{unread}</span>
                  )}
                </button>
              )}
              <span className="flex items-center gap-1.5 pr-3 text-sm font-semibold text-white/70">
                <Users className="size-4" /> {audio.members.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Room() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [details, reload] = useRoomDetails(roomId);
  const [sharing, setSharing] = useState(Boolean((location.state as { justCreated?: boolean } | null)?.justCreated));
  const [deleting, setDeleting] = useState(false);

  if (details === null) return <NotFound />;
  const room = details?.room;

  return (
    <AppShell backdrop="mountains">
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-44 sm:px-6 sm:pt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link to="/rooms" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-white">
            <ArrowLeft className="size-4" /> All rooms
          </Link>
          {details && !details.locked && (
            <div className="flex items-center gap-2">
              {details.canManage ? (
                <>
                  <Button variant="glass" size="sm" onClick={() => setSharing(true)}><UserPlus className="size-4" /> Invite</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(true)} aria-label="Delete room" title="Delete room">
                    <Trash2 className="size-4" />
                  </Button>
                </>
              ) : (
                room?.kind === 'public' && <CopyLinkButton />
              )}
            </div>
          )}
        </div>

        {!details || !room ? (
          <div className="grid h-60 place-items-center"><Spinner className="size-7" /></div>
        ) : (
          <>
            {details.locked ? (
              <>
                <RoomHeader room={room} />
                <PasscodeGate room={room} onUnlocked={reload} />
              </>
            ) : (
              <Stage key={room.id} room={room} header={<RoomHeader room={room} />} onLocked={reload} />
            )}

            {details.canManage && details.passcode && (
              <ShareRoomDialog open={sharing} onClose={() => setSharing(false)} room={room} passcode={details.passcode} />
            )}
            <ConfirmDialog
              open={deleting}
              onClose={() => setDeleting(false)}
              title="Delete this room?"
              body={<>Everyone inside will be removed, the chat disappears, and the link stops working. <strong className="text-white">This can't be undone.</strong></>}
              confirmLabel="Delete room"
              onConfirm={async () => {
                await api.delete(`/api/rooms/${room.id}`);
                navigate('/rooms', { replace: true });
              }}
            />
          </>
        )}
      </main>
    </AppShell>
  );
}
