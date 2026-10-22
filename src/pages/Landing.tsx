import { useEffect, useState } from 'react';
import { ChevronDown, Headphones, Mic, Radio, ShieldCheck } from 'lucide-react';
import type { RoomSummary } from '../../shared/protocol.ts';
import { api } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import AuthDialog, { type AuthMode } from '../components/AuthDialog.tsx';
import Button from '../components/Button.tsx';
import Logo from '../components/Logo.tsx';
import MountainScene from '../components/MountainScene.tsx';
import Spinner from '../components/Spinner.tsx';

const FEATURES = [
  { icon: Radio, title: 'Live, right now', text: 'Every room is happening in real time. Drop in, and leave quietly whenever you like.' },
  { icon: Headphones, title: 'Listen or talk', text: 'Join muted and just listen, or unmute and add your voice to the conversation.' },
  { icon: ShieldCheck, title: 'Hosts keep it civil', text: "The first person in a room hosts it and can mute anyone who's out of line." },
];

function useLiveCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    api.get<RoomSummary[]>('/api/rooms')
      .then(rooms => setCount(rooms.reduce((sum, room) => sum + room.listeners, 0)))
      .catch(() => setCount(null));
  }, []);
  return count;
}

export default function Landing() {
  const { enterAsGuest } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);
  const liveCount = useLiveCount();

  async function onGuest() {
    setGuestBusy(true);
    try {
      await enterAsGuest();
    } catch {
      setGuestBusy(false);
    }
  }

  return (
    <>
      <section className="relative isolate flex min-h-[max(100svh,640px)] flex-col overflow-hidden">
        <MountainScene parallax anchor="horizon" className="-z-10" />

        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-5 sm:px-6 sm:pt-7">
          <Logo className="text-xl sm:text-2xl" />
          <Button variant="glass" size="sm" onClick={() => setAuthMode('login')}>Sign in</Button>
        </nav>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 pt-[9vh] text-center sm:pt-[11vh]">
          {liveCount !== null && (
            <div className="glass mb-7 inline-flex animate-rise items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide sm:text-sm">
              <span className="size-2 animate-live rounded-full bg-live" />
              {liveCount === 0 ? '10 rooms open. Be the first to start talking' : `${liveCount} ${liveCount === 1 ? 'person' : 'people'} talking right now`}
            </div>
          )}

          <h1 className="animate-rise text-[clamp(2.4rem,7vw,5rem)] leading-[1.05] font-extralight tracking-tight text-balance [text-shadow:0_4px_30px_rgb(0_0_0/0.4)]">
            Meet new people <span className="font-black">every day.</span>
          </h1>
          <p className="mt-5 max-w-xl animate-rise text-base text-balance text-white/80 [animation-delay:120ms] sm:text-xl sm:font-light">
            Listen to live conversations from all around the world, or jump in and talk.
          </p>

          <div className="mt-9 flex w-full animate-rise flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setAuthMode('signup')}>
              <Mic className="size-4.5" /> Get started, it's free
            </Button>
            <Button size="lg" variant="glass" className="w-full sm:w-auto" onClick={onGuest} disabled={guestBusy}>
              {guestBusy ? <Spinner /> : 'Enter as guest'}
            </Button>
          </div>
        </div>

        <a
          href="#features"
          className="mx-auto mb-6 flex flex-col items-center gap-1 text-xs font-medium tracking-[0.25em] text-white/60 uppercase transition hover:text-white"
        >
          Scroll
          <ChevronDown className="size-5 animate-bounce" />
        </a>
      </section>

      <main id="features" className="relative mx-auto max-w-6xl scroll-mt-8 px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Conversations, not feeds.</h2>
          <p className="mt-4 text-white/60 sm:text-lg">
            AudioSpace is a place to hang out with your voice. No posts, no likes, just people talking.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="glass rounded-3xl p-7">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent/20 text-accent ring-1 ring-accent/30">
                <Icon className="size-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
            </div>
          ))}
        </div>

        <div className="glass relative mt-20 overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12">
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-top/60 via-accent-strong/20 to-transparent" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Pull up a chair.</h2>
          <p className="mx-auto mt-3 max-w-md text-white/70">Ten rooms are open, from Bollywood sing-alongs to finance talk.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => setAuthMode('signup')}>Create an account</Button>
            <Button size="lg" variant="glass" onClick={onGuest} disabled={guestBusy}>Look around as a guest</Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-white/40">
        AudioSpace © {new Date().getFullYear()}
      </footer>

      <AuthDialog mode={authMode} onModeChange={setAuthMode} />
    </>
  );
}
