import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth.tsx';
import Avatar from './Avatar.tsx';
import Logo from './Logo.tsx';

/** Header and night-sky backdrop shared by the signed-in pages. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="relative isolate min-h-svh">
      <div aria-hidden className="fixed inset-0 -z-10 bg-night-900">
        <img src="/images/sky.webp" alt="" className="h-[70vh] w-full object-cover object-top opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-night-900/10 via-night-900/80 to-night-900" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/5 bg-night-900/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo to="/rooms" className="text-xl" />
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1 sm:pr-3">
                <Avatar name={user.name} size="sm" className="ring-0" />
                <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{user.name}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="grid size-10 cursor-pointer place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="size-4.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {children}
    </div>
  );
}
