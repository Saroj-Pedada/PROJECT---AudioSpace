import type { ReactNode } from 'react';
import { Crown, MicOff, ShieldCheck } from 'lucide-react';
import Avatar from './Avatar.tsx';

export interface StagePerson {
  key: string;
  seed: string;
  name: string;
  caption?: ReactNode;
  speaking?: boolean;
  muted?: boolean;
  host?: boolean;
  admin?: boolean;
  /** Extra control under the name, e.g. a moderator's mute button. */
  action?: ReactNode;
}

interface MoonStageProps {
  people: StagePerson[];
  emoji: string;
  className?: string;
}

/** People gathered in a ring around a glowing moon that pulses while anyone talks. */
export default function MoonStage({ people, emoji, className = '' }: MoonStageProps) {
  const speakers = people.filter(p => p.speaking && !p.muted).length;
  const glow = Math.min(1, speakers / 3);

  return (
    <div className={`relative mx-auto aspect-square w-full max-w-[640px] sm:aspect-[5/4] ${className}`}>
      {/* The moon */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {speakers > 0 && (
          <>
            <span className="absolute inset-0 animate-ripple rounded-full border border-violet-200/40" />
            <span className="absolute inset-0 animate-ripple rounded-full border border-violet-200/30 [animation-delay:0.8s]" />
          </>
        )}
        <div
          className="relative grid size-[clamp(84px,22vw,150px)] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffdf6,#e9e0ff_40%,#b9a8ff_72%,#7b61ff)] transition-[transform,box-shadow] duration-500"
          style={{
            transform: `scale(${1 + glow * 0.1})`,
            boxShadow: `0 0 ${60 + glow * 80}px ${14 + glow * 22}px rgb(185 168 255 / ${0.3 + glow * 0.3}), 0 0 220px 60px rgb(123 97 255 / 0.18)`,
          }}
        >
          <span className="text-[clamp(2rem,6vw,3.4rem)] drop-shadow-[0_2px_6px_rgb(60_35_157/0.5)]">{emoji}</span>
        </div>
      </div>

      {/* The ring of people */}
      <ul>
        {people.map((person, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(people.length, 1);
          const x = 50 + 39 * Math.cos(angle);
          const y = 50 + 37 * Math.sin(angle);
          return (
            <li
              key={person.key}
              className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 animate-rise flex-col items-center text-center transition-[left,top] duration-700 sm:w-32"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className={`relative ${person.speaking && !person.muted ? 'animate-float' : ''}`}>
                {person.speaking && !person.muted && (
                  <span className="absolute inset-0 animate-ripple rounded-full bg-speak/30" />
                )}
                <Avatar seed={person.seed} speaking={person.speaking && !person.muted} className="relative size-14 ring-2 ring-white/10 sm:size-20" />
                {person.host && (
                  <span title="Host" className="absolute -top-1 -left-1 grid size-6 place-items-center rounded-full bg-amber-400 text-night-900 shadow-lg ring-3 ring-night-900 sm:size-7">
                    <Crown className="size-3 sm:size-3.5" strokeWidth={2.5} />
                  </span>
                )}
                {person.admin && (
                  <span title="Admin" className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-sky-300 text-night-900 shadow-lg ring-3 ring-night-900 sm:size-7">
                    <ShieldCheck className="size-3 sm:size-3.5" strokeWidth={2.5} />
                  </span>
                )}
                {person.muted && (
                  <span title="Muted" className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-night-700 text-white/80 shadow-lg ring-3 ring-night-900 sm:size-7">
                    <MicOff className="size-3 sm:size-3.5" />
                  </span>
                )}
              </div>
              <p className="mt-2 w-full truncate text-xs font-semibold [text-shadow:0_1px_8px_rgb(0_0_0/0.8)] sm:text-sm" title={person.name}>
                {person.name}
              </p>
              {person.caption && <p className="text-[11px] text-white/50 [text-shadow:0_1px_8px_rgb(0_0_0/0.8)]">{person.caption}</p>}
              {person.action}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
