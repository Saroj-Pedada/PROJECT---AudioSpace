import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Users } from 'lucide-react';
import type { RoomSummary } from '../../shared/protocol.ts';
import { useAuth } from '../lib/auth.tsx';
import { createSocket } from '../lib/socket.ts';
import AppShell from '../components/AppShell.tsx';
import Avatar from '../components/Avatar.tsx';
import Spinner from '../components/Spinner.tsx';

function useLiveRooms() {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);

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

function RoomCard({ room }: { room: RoomSummary }) {
  const live = room.listeners > 0;
  const full = room.listeners >= room.capacity;
  const shown = room.members.slice(0, 4);

  return (
    <Link
      to={`/rooms/${room.id}`}
      aria-disabled={full}
      className={[
        'glass group relative flex flex-col rounded-3xl p-6 transition duration-300',
        'hover:-translate-y-1 hover:border-white/30 hover:bg-white/[0.09] hover:shadow-accent/10',
        full ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/10">{room.emoji}</div>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-live uppercase ring-1 ring-live/30">
            <span className="size-1.5 animate-live rounded-full bg-live" />
            {full ? 'Full' : 'Live'}
          </span>
        )}
      </div>

      <h2 className="mt-5 text-lg leading-snug font-bold">{room.name}</h2>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/55">{room.description}</p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        {live ? (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {shown.map(m => <Avatar key={m.id} name={m.name} size="xs" />)}
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

export default function Lobby() {
  const { user } = useAuth();
  const rooms = useLiveRooms();
  const liveRooms = rooms?.filter(r => r.listeners > 0) ?? [];
  const quietRooms = rooms?.filter(r => r.listeners === 0) ?? [];

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
        <p className="text-sm font-semibold text-accent">{greeting()}, {user?.name.split(' ')[0]}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Where do you want to hang out?</h1>

        {!rooms ? (
          <div className="grid h-60 place-items-center"><Spinner className="size-7" /></div>
        ) : (
          <>
            {liveRooms.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-4 flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-white/50 uppercase">
                  <span className="size-2 animate-live rounded-full bg-live" /> Happening now
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {liveRooms.map(room => <RoomCard key={room.id} room={room} />)}
                </div>
              </section>
            )}
            <section className="mt-10">
              <h2 className="mb-4 text-xs font-bold tracking-[0.2em] text-white/50 uppercase">
                {liveRooms.length > 0 ? 'Other rooms' : 'All rooms'}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {quietRooms.map(room => <RoomCard key={room.id} room={room} />)}
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
