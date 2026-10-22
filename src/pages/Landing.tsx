import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { LobbyRooms } from '../../shared/protocol.ts';
import { api } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import AuthDialog, { type AuthMode } from '../components/AuthDialog.tsx';
import Avatar from '../components/Avatar.tsx';
import Button, { buttonClasses } from '../components/Button.tsx';
import FlyThroughHero from '../components/FlyThroughHero.tsx';
import Logo from '../components/Logo.tsx';
import MoonStage, { type StagePerson } from '../components/MoonStage.tsx';
import MountainScene from '../components/MountainScene.tsx';

function useLiveCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    api.get<LobbyRooms>('/api/rooms')
      .then(rooms => setCount(rooms.public.reduce((sum, room) => sum + room.listeners, 0)))
      .catch(() => setCount(null));
  }, []);
  return count;
}

// ---------- Demo room: a fake conversation that loops forever ----------

const DEMO_PEOPLE = [
  { seed: 'midnight-chai', name: 'chai.addict' },
  { seed: 'ridge-runner', name: 'Ananya' },
  { seed: 'lofi-owl', name: 'owl_at_3am' },
  { seed: 'paper-planes', name: 'Kabir' },
  { seed: 'moon-whisper', name: 'meera.sings' },
  { seed: 'static-noise', name: 'Rohan' },
];

const DEMO_LINES = [
  'who brought the guitar??',
  'ok that joke actually landed 😂',
  'brb, chai',
  'this message will self-destruct',
  'screenshots? never heard of her',
  'kabir sing the chorus again',
  'wait who is the host',
  'meera your mic is 10/10',
];

function useDemoConversation() {
  const [speaking, setSpeaking] = useState<Set<number>>(new Set([1]));
  const [bubbles, setBubbles] = useState<{ id: number; text: string; who: number }[]>([]);

  useEffect(() => {
    let n = 0;
    const talk = setInterval(() => {
      const next = new Set<number>();
      next.add(Math.floor(Math.random() * DEMO_PEOPLE.length));
      if (Math.random() > 0.6) next.add(Math.floor(Math.random() * DEMO_PEOPLE.length));
      setSpeaking(next);
    }, 1500);
    const chat = setInterval(() => {
      const id = n++;
      setBubbles(prev => [...prev.slice(-3), { id, text: DEMO_LINES[id % DEMO_LINES.length], who: id % DEMO_PEOPLE.length }]);
    }, 2400);
    return () => {
      clearInterval(talk);
      clearInterval(chat);
    };
  }, []);

  return { speaking, bubbles };
}

function DemoRoom() {
  const { speaking, bubbles } = useDemoConversation();
  const people: StagePerson[] = DEMO_PEOPLE.map((p, i) => ({
    key: p.seed,
    seed: p.seed,
    name: p.name,
    speaking: speaking.has(i),
    muted: i === 5,
    host: i === 1,
    caption: i === 5 ? 'Listening' : undefined,
  }));

  return (
    <div>
      <MoonStage people={people} emoji="🎸" />
      {/* Chat that evaporates as you watch */}
      <div className="pointer-events-none mt-4 flex h-32 flex-col items-center justify-end gap-2" aria-hidden>
        {bubbles.map(b => (
          <div key={b.id} className="flex animate-evaporate items-center gap-2 rounded-full bg-night-800/85 py-1.5 pr-4 pl-1.5 text-sm shadow-xl ring-1 ring-white/10 backdrop-blur">
            <Avatar seed={DEMO_PEOPLE[b.who].seed} size="xs" />
            <span className="text-white/85">{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Page ----------

const MARQUEE = ['Bollywood Pop', 'Standup Comedy', 'Mahabharata', 'Finance Society', 'Chit Chat', 'Party Music', 'Musafir Stories', "Musicians' Assembly", 'Political Debates', 'Just for Fun'];

const RULES = [
  ['01', 'Nothing gets recorded.', 'Voices travel straight between browsers. We never hear them, and we couldn’t play them back if we tried.'],
  ['02', 'Six digits keep strangers out.', 'Make a private room, pick a passcode, send it to your people. It’s yours until you delete it, even when everyone’s gone home.'],
  ['03', 'Chats evaporate.', 'In private rooms, every message fades out five minutes after it’s sent. Say the thing.'],
] as const;

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // Sent here from a protected page? Open sign-in straight away.
  const [authMode, setAuthMode] = useState<AuthMode | null>(from && !user ? 'login' : null);
  const liveCount = useLiveCount();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Once signing in succeeds, carry on to wherever they were headed.
  useEffect(() => {
    if (user && authMode) {
      setAuthMode(null);
      navigate(from ?? '/rooms');
    }
  }, [user, authMode, from, navigate]);

  const primaryCta = user ? (
    <Link to="/rooms" className={buttonClasses('primary', 'lg')}>Enter the rooms <ArrowRight className="size-4.5" /></Link>
  ) : (
    <Button size="lg" onClick={() => setAuthMode('signup')}>Claim your name <ArrowRight className="size-4.5" /></Button>
  );

  return (
    <div className="bg-night-900">
      <nav
        className={`fixed inset-x-0 top-0 z-30 border-b transition-colors duration-500 ${
          scrolled ? 'border-white/5 bg-night-900/60 backdrop-blur-xl' : 'border-transparent bg-gradient-to-b from-night-950/50 to-transparent'
        }`}
      >
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo className="text-xl sm:text-2xl" />
          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/rooms" className={buttonClasses('glass', 'sm')}>Rooms</Link>
              <Link to="/profile" title="Your profile"><Avatar seed={user.avatarSeed} size="sm" className="ring-2 ring-white/20" /></Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAuthMode('login')}>Sign in</Button>
              <Button variant="glass" size="sm" onClick={() => setAuthMode('signup')}>Join</Button>
            </div>
          )}
        </div>
      </nav>

      <FlyThroughHero
        beats={[
          <div className="text-center">
            <p className="mb-6 text-xs font-semibold tracking-[0.4em] text-violet-200/80 uppercase">live audio, under the stars</p>
            <h1 className="text-[clamp(3rem,10vw,8.5rem)] leading-[0.92] font-extralight tracking-tight [text-shadow:0_6px_40px_rgb(0_0_0/0.45)]">
              Meet new people<br /><span className="font-black italic">every day.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-md text-base text-white/80 sm:text-lg">Listen to live conversations from all around the world.</p>
          </div>,
          <div className="text-center">
            <h2 className="text-[clamp(4rem,17vw,15rem)] leading-[0.8] font-black tracking-tighter uppercase">
              <span className="text-outline block text-white/90">Say it</span>
              <span className="block bg-gradient-to-b from-white to-violet-300 bg-clip-text text-transparent">out loud.</span>
            </h2>
            <p className="mx-auto mt-8 max-w-sm text-base text-white/75 sm:text-lg">No posts. No likes. No algorithm deciding who gets to hear you.</p>
          </div>,
          <div className="text-center">
            <h2 className="text-[clamp(2.8rem,8vw,7rem)] leading-[0.95] font-black tracking-tight [text-shadow:0_6px_40px_rgb(0_0_0/0.5)]">
              The mountains<br /><span className="font-extralight italic">are listening.</span>
            </h2>
            {liveCount !== null && (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-night-900/50 px-4 py-1.5 text-sm font-medium backdrop-blur">
                <span className="size-2 animate-live rounded-full bg-live" />
                {liveCount === 0 ? 'Every room is quiet. Go be the first voice.' : `${liveCount} ${liveCount === 1 ? 'voice' : 'voices'} up here right now`}
              </p>
            )}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {primaryCta}
              {!user && <Button size="lg" variant="glass" onClick={() => setAuthMode('login')}>I've been here before</Button>}
            </div>
          </div>,
        ]}
      />

      {/* What a room actually looks like */}
      <section className="relative mx-auto grid max-w-6xl scroll-mt-20 items-center gap-16 px-4 py-28 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-bold tracking-[0.35em] text-accent uppercase">Inside a room</p>
          <h2 className="mt-4 text-5xl leading-[0.95] font-black tracking-tight sm:text-6xl">Pull up<br />a rock.</h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/65">
            Everyone sits in a circle around the moon. Whoever's talking glows. Tap the mic when you've got something to say, tap it again when
            you're done. <span className="text-white">That's the whole app.</span>
          </p>
          <p className="mt-4 max-w-md text-white/45">Up to eight people per room. Whoever walks in first hosts, and the host holds the mute button.</p>
        </div>
        <DemoRoom />
      </section>

      {/* Room names, too big to fit */}
      <section className="overflow-hidden border-y border-white/5 py-10" aria-label="Public rooms">
        {[0, 1].map(row => (
          <div key={row} className={`flex w-max animate-marquee gap-10 whitespace-nowrap ${row ? '[animation-direction:reverse] mt-2' : ''}`}>
            {[...MARQUEE, ...MARQUEE].map((name, i) => (
              <span
                key={i}
                className={`text-6xl font-black tracking-tight uppercase sm:text-8xl ${(i + row) % 2 ? 'text-outline text-white/30' : 'text-white/90'}`}
              >
                {name}<span className="ml-10 text-accent">✦</span>
              </span>
            ))}
          </div>
        ))}
      </section>

      {/* House rules */}
      <section className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
        <h2 className="max-w-2xl text-5xl leading-[0.95] font-black tracking-tight sm:text-6xl">House rules<br /><span className="font-extralight italic text-white/60">of the mountain.</span></h2>
        <ol className="mt-16 grid gap-px overflow-hidden rounded-3xl bg-white/10 md:grid-cols-3">
          {RULES.map(([n, title, body]) => (
            <li key={n} className="group bg-night-900 p-8 transition-colors hover:bg-night-800 sm:p-10">
              <span className="text-outline block text-7xl font-black text-accent transition group-hover:text-violet-300">{n}</span>
              <h3 className="mt-8 text-2xl font-bold">{title}</h3>
              <p className="mt-3 leading-relaxed text-white/55">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Final call, back in the mountains */}
      <section className="relative isolate flex h-[85svh] min-h-[560px] items-center justify-center overflow-hidden text-center">
        <MountainScene pointer anchor="horizon" className="-z-10" />
        <div className="-mt-[18vh] px-4">
          <h2 className="text-[clamp(3rem,9vw,7.5rem)] leading-[0.9] font-black tracking-tight [text-shadow:0_6px_40px_rgb(0_0_0/0.5)]">
            See you<br /><span className="font-extralight italic">up there.</span>
          </h2>
          <div className="mt-10 flex justify-center">{primaryCta}</div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-4 py-10 text-center text-sm text-white/40">
        <p>AudioSpace started as a second-year college project. Years later, it got a second life.</p>
        <p className="mt-1 text-white/25">© {new Date().getFullYear()} AudioSpace</p>
      </footer>

      <AuthDialog mode={authMode} onModeChange={setAuthMode} />
    </div>
  );
}
