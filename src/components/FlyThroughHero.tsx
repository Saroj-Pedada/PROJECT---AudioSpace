import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import MountainScene, { LAYERS, type SceneHandle } from './MountainScene.tsx';

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** [start, end] of each text beat, as fractions of the hero's scroll distance. */
const BEATS: [number, number][] = [[0, 0.24], [0.32, 0.6], [0.68, 1]];

interface FlyThroughHeroProps {
  beats: [ReactNode, ReactNode, ReactNode];
}

/**
 * A pinned hero: scrolling flies the camera into the mountain range. Each ridge scales and falls away
 * at its own depth, the sky stretches, the moon climbs, and three lines of copy surface in turn.
 * Scroll position is eased every frame so the motion glides instead of tracking the wheel 1:1.
 */
export default function FlyThroughHero({ beats }: FlyThroughHeroProps) {
  const section = useRef<HTMLElement>(null);
  const scene = useRef<SceneHandle>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const veil = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let target = 0;
    let p = -1;
    let frame = 0;

    const measure = () => {
      const el = section.current;
      if (!el) return;
      const distance = el.offsetHeight - window.innerHeight;
      target = distance > 0 ? clamp((window.scrollY - el.offsetTop) / distance) : 0;
    };

    const apply = (p: number) => {
      const s = scene.current;
      if (!s) return;
      if (s.sky) s.sky.style.transform = `translate3d(0, ${-p * 8}%, 0) scale(${1 + p * 0.4})`;
      if (s.moon) s.moon.style.transform = `translate3d(${-p * 18}vw, ${-p * 22}vh, 0) scale(${1 + p * 0.9})`;

      // Fly forward: near ridges swell and drop out of frame first, far ones slowly loom.
      s.layers.forEach((layer, i) => {
        if (!layer) return;
        const depth = LAYERS[i][3];
        const scale = 1 + p * (0.06 + depth * depth * 2.4);
        const fall = Math.pow(p, 1.35) * depth * 135;
        layer.style.transform = `translate3d(0, ${fall}%, 0) scale(${scale})`;
      });
      s.fogs.forEach(fog => {
        if (fog) fog.style.opacity = String(0.7 + 1.6 * Math.sin(Math.PI * clamp(p * 1.1)));
      });

      BEATS.forEach(([a, b], i) => {
        const el = beatRefs.current[i];
        if (!el) return;
        const fadeIn = i === 0 ? 1 : smooth(a, a + 0.1, p);
        const fadeOut = i === BEATS.length - 1 ? 1 : 1 - smooth(b - 0.1, b, p);
        const o = fadeIn * fadeOut;
        el.style.opacity = String(o);
        el.style.transform = `translate3d(0, ${(1 - fadeIn) * 70 - (1 - fadeOut) * 70}px, 0) scale(${0.94 + 0.06 * o})`;
        el.style.filter = o > 0.99 ? 'none' : `blur(${(1 - o) * 16}px)`;
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
        dots.current[i]?.classList.toggle('bg-white', o > 0.5);
      });

      if (veil.current) veil.current.style.opacity = String(smooth(0.8, 1, p) * 0.7);
      if (cue.current) cue.current.style.opacity = String(1 - smooth(0, 0.05, p));
    };

    const render = () => {
      // Ease toward the scroll position; snap when close enough to stop sub-pixel jitter.
      const next = reduced || p < 0 ? target : p + (target - p) * 0.075;
      if (Math.abs(next - p) > 0.00005) {
        p = Math.abs(target - next) < 0.0005 ? target : next;
        apply(p);
      }
      frame = requestAnimationFrame(render);
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    frame = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={section} className="relative h-[340vh] motion-reduce:h-[220vh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        <MountainScene ref={scene} pointer anchor="horizon" />
        <div ref={veil} className="pointer-events-none absolute inset-0 bg-night-900 opacity-0" />

        {beats.map((beat, i) => (
          <div
            key={i}
            ref={el => { beatRefs.current[i] = el; }}
            className="absolute inset-0 flex items-center justify-center px-4 pb-[12vh] will-change-[opacity,transform,filter]"
            style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? 'visible' : 'hidden' }}
          >
            {beat}
          </div>
        ))}

        {/* Progress through the three beats */}
        <div className="absolute top-1/2 right-4 hidden -translate-y-1/2 flex-col gap-3 sm:right-6 sm:flex" aria-hidden>
          {BEATS.map((_, i) => (
            <span key={i} ref={el => { dots.current[i] = el; }} className="size-1.5 rounded-full bg-white/25 transition-colors duration-500" />
          ))}
        </div>

        <div ref={cue} className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 text-[11px] font-semibold tracking-[0.35em] text-white/70 uppercase">
          Scroll to dive in
          <ChevronDown className="size-5 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
