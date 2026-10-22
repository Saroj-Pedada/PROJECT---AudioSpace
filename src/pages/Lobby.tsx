import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Lock, Plus, Users } from 'lucide-react';
import type { LobbyRooms, RoomSummary } from '../../shared/protocol.ts';
import { MAX_PRIVATE_ROOMS_PER_USER } from '../../shared/validation.ts';
import { useUser } from '../lib/auth.tsx';
import { createSocket } from '../lib/socket.ts';
import AppShell from '../components/AppShell.tsx';
import Avatar from '../components/Avatar.tsx';
import Button from '../components/Button.tsx';
import CreateRoomDialog from '../components/CreateRoomDialog.tsx';
import Spinner from '../components/Spinner.tsx';

function useLiveRooms() {
  const [rooms, setRooms] = useState<LobbyRooms | null>(null);

  useEffect(() => {
    const socket = createSocket();
    socket.on('connect', () => socket.emit('watch rooms'));
    socket.on('rooms', setRooms);
    return () => {
      socket.disconnect();
    };
  }, []);

  return rooms;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function RoomCard({ room, selfId }: { room: RoomSummary; selfId: number }) {
  const live = room.listeners > 0;
  const full = room.listeners >= room.capacity;
  const isPrivate = room.kind === 'private';

  return (
    <Link
      to={`/rooms/${room.id}`}
      aria-disabled={full}
      className={[
        'glass group relative flex flex-col rounded-3xl p-6 transition duration-300',
        'hover:-translate-y-1 hover:border-white/30 hover:bg-white/[0.09]',
        isPrivate ? 'bg-accent-strong/[0.07]' : '',
        full ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/10">{room.emoji}</div>
        <div className="flex items-center gap-1.5">
          {isPrivate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-accent uppercase ring-1 ring-accent/30">
              <Lock className="size-3" /> Private
            </span>
          )}
          {live && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-live uppercase ring-1 ring-live/30">
              <span className="size-1.5 animate-live rounded-full bg-live" />
              {full ? 'Full' : 'Live'}
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-5 text-lg leading-snug font-bold">{room.name}</h3>
      {isPrivate && (
        <p className="mt-0.5 text-xs font-medium text-white/45">
          {room.ownerId === selfId ? 'Your room' : `Hosted by ${room.ownerName}`}
        </p>
      )}
      {room.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/55">{room.description}</p>}

      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        {live ? (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {room.members.slice(0, 4).map(m => <Avatar key={m.id} seed={m.avatarSeed} size="xs" className="ring-2 ring-night-800" />)}
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-white/60">
              <Users className="size-3.5" /> {room.listeners}/{room.capacity}
            </span>
          </div>
        ) : (
          <span className="text-xs font-medium text-white/40">Quiet. Be the first to start talking.</span>
        )}
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 transition group-hover:bg-accent-strong">
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-white/50 uppercase">{children}</h2>;
}

export default function Lobby() {
  const user = useUser();
  const rooms = useLiveRooms();
  const [creating, setCreating] = useState(false);

  const livePublic = rooms?.public.filter(r => r.listeners > 0) ?? [];
  const quietPublic = rooms?.public.filter(r => r.listeners === 0) ?? [];
  const ownedCount = rooms?.private.filter(r => r.ownerId === user.id).length ?? 0;
  const canCreate = user.isAdmin || ownedCount < MAX_PRIVATE_ROOMS_PER_USER;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-accent">{greeting()}, {user.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Where do you want to hang out?</h1>
          </div>
          <Button onClick={() => setCreating(true)} disabled={!canCreate} title={canCreate ? undefined : `You can have up to ${MAX_PRIVATE_ROOMS_PER_USER} private rooms`}>
            <Plus className="size-4.5" /> New private room
          </Button>
        </div>

        {!rooms ? (
          <div className="grid h-60 place-items-center"><Spinner className="size-7" /></div>
        ) : (
          <>
            <section className="mt-10">
              <SectionTitle><Lock className="size-3.5" /> {user.isAdmin ? 'All private rooms' : 'Your private rooms'}</SectionTitle>
              {rooms.private.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.private.map(room => <RoomCard key={room.id} room={room} selfId={user.id} />)}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-3xl border border-dashed border-white/20 px-6 py-10 text-center transition hover:border-accent/60 hover:bg-accent/5"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-accent/20 text-accent"><Plus className="size-6" /></span>
                  <span className="font-bold">Make a room just for your friends</span>
                  <span className="max-w-md text-sm text-white/55">
                    Private rooms are protected by a 6-digit passcode, have a disappearing chat, and stay around until you delete them.
                  </span>
                </button>
              )}
            </section>

            {livePublic.length > 0 && (
              <section className="mt-12">
                <SectionTitle><span className="size-2 animate-live rounded-full bg-live" /> Happening now</SectionTitle>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {livePublic.map(room => <RoomCard key={room.id} room={room} selfId={user.id} />)}
                </div>
              </section>
            )}

            <section className="mt-12">
              <SectionTitle>{livePublic.length > 0 ? 'Other public rooms' : 'Public rooms'}</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {quietPublic.map(room => <RoomCard key={room.id} room={room} selfId={user.id} />)}
              </div>
            </section>
          </>
        )}
      </main>

      <CreateRoomDialog open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}
