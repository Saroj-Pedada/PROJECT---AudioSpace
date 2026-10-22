import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.tsx';
import Avatar from './Avatar.tsx';
import Logo from './Logo.tsx';
import MountainScene from './MountainScene.tsx';

interface AppShellProps {
  children: ReactNode;
  /** 'sky' is a calm gradient for browsing; 'mountains' puts you inside the scene (rooms). */
  backdrop?: 'sky' | 'mountains';
}

/** Header and night-sky backdrop shared by the signed-in pages. */
export default function AppShell({ children, backdrop = 'sky' }: AppShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="relative isolate min-h-svh">
      {backdrop === 'mountains' ? (
        <div className="fixed inset-0 -z-10">
          <MountainScene pointer anchor="horizon" dim={0.35} />
        </div>
      ) : (
        <div aria-hidden className="fixed inset-0 -z-10 bg-night-900">
          <img src="/images/sky.webp" alt="" className="h-[70vh] w-full object-cover object-top opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-night-900/10 via-night-900/80 to-night-900" />
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-white/5 bg-night-900/50 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo to="/" className="text-xl" />
          {user && (
            <nav className="flex items-center gap-1">
              <Link to="/rooms" className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white sm:block">
                Rooms
              </Link>
              <Link
                to="/profile"
                title="Your profile"
                className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1 transition hover:bg-white/10 sm:pr-3.5"
              >
                <Avatar seed={user.avatarSeed} size="sm" />
                <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{user.name}</span>
                {user.isAdmin && <ShieldCheck className="hidden size-4 text-sky-300 sm:block" aria-label="Admin" />}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="grid size-10 cursor-pointer place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="size-4.5" />
              </button>
            </nav>
          )}
        </div>
      </header>

      {children}
    </div>
  );
}
