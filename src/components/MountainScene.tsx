import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Layer geometry from the original 1920px-wide design: [layer, top, height, depth] inside a 1086px-tall band.
// Depth runs from 0 (farthest) to 1 (nearest) and drives every parallax effect.
const BAND_HEIGHT = 1086.48;
export const LAYERS = [
  [8, 66, 1020.48, 0],
  [7, 47, 1022.98, 0.14],
  [6, 103, 924.29, 0.28],
  [5, 128, 897.79, 0.42],
  [4, 0, 937.34, 0.56],
  [3, 229, 785.47, 0.7],
  [2, 328, 708.67, 0.85],
  [1, 304, 762.43, 1],
] as const;

/** Elements of the scene a parent can animate directly (for the scroll-driven landing hero). */
export interface SceneHandle {
  sky: HTMLDivElement | null;
  moon: HTMLDivElement | null;
  band: HTMLDivElement | null;
  layers: (HTMLImageElement | null)[];
  fogs: (HTMLDivElement | null)[];
}

interface MountainSceneProps {
  /** Drift the layers with the pointer (or device tilt) for depth. */
  pointer?: boolean;
  /** 'horizon' starts the range part-way down so more sky shows; 'bottom' sits it on the bottom edge. */
  anchor?: 'horizon' | 'bottom';
  /** Dim the scene so foreground UI stays readable. */
  dim?: number;
  className?: string;
}

const MountainScene = forwardRef<SceneHandle, MountainSceneProps>(function MountainScene(
  { pointer = false, anchor = 'bottom', dim = 0, className = '' },
  ref,
) {
  const sky = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLImageElement | null)[]>([]);
  const fogs = useRef<(HTMLDivElement | null)[]>([]);
  const pointerWrap = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    get sky() { return sky.current; },
    get moon() { return moon.current; },
    get band() { return band.current; },
    get layers() { return layers.current; },
    get fogs() { return fogs.current; },
  }));

  // Pointer parallax: eased so the scene floats rather than snaps.
  useEffect(() => {
    if (!pointer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, frame = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
      ty = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90));
    };
    const tick = () => {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      pointerWrap.current?.style.setProperty('--px', x.toFixed(4));
      pointerWrap.current?.style.setProperty('--py', y.toFixed(4));
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
      cancelAnimationFrame(frame);
    };
  }, [pointer]);

  return (
    <div aria-hidden ref={pointerWrap} className={`pointer-events-none absolute inset-0 overflow-hidden bg-night-900 ${className}`}>
      <div ref={sky} className="absolute inset-0 origin-top will-change-transform">
        <div
          className="absolute -inset-[4%] transition-none"
          style={{ transform: 'translate3d(calc(var(--px, 0) * -18px), calc(var(--py, 0) * -10px), 0)' }}
        >
          <img src="/images/sky.webp" alt="" className="h-full w-full animate-twinkle object-cover object-top" />
        </div>
      </div>

      {/* The moon: a soft lavender glow that rises behind the ridges. */}
      <div ref={moon} className="absolute top-[14%] left-[68%] size-[clamp(70px,11vw,170px)] will-change-transform">
        <div className="size-full" style={{ transform: 'translate3d(calc(var(--px, 0) * -26px), calc(var(--py, 0) * -14px), 0)' }}>
          <div className="size-full rounded-full bg-[radial-gradient(circle_at_35%_35%,#fffdf6,#e9e0ff_45%,#b9a8ff_75%,#8f7cff)] shadow-[0_0_80px_20px_rgb(185_168_255/0.35),0_0_200px_60px_rgb(123_97_255/0.2)]" />
        </div>
      </div>

      <div
        ref={band}
        className={`absolute left-1/2 aspect-[1920/1086] w-full min-w-[820px] -translate-x-1/2 ${
          // Start ~a third of the way down, but never leave a gap below the range.
          anchor === 'horizon' ? 'top-[max(34%,calc(100%-max(820px,100vw)*0.5656))]' : 'bottom-0'
        }`}
      >
        {LAYERS.map(([n, top, height, depth], i) => (
          <div
            key={n}
            className="absolute inset-x-0"
            style={{
              top: `${(top / BAND_HEIGHT) * 100}%`,
              height: `${(height / BAND_HEIGHT) * 100}%`,
              transform: `translate3d(calc(var(--px, 0) * ${(depth * 70).toFixed(1)}px), calc(var(--py, 0) * ${(depth * 22).toFixed(1)}px), 0)`,
            }}
          >
            <img
              ref={el => { layers.current[i] = el; }}
              src={`/images/mtn_${n}.webp`}
              alt=""
              className="absolute inset-0 size-full origin-bottom will-change-transform"
            />
            {/* Fog drifting between every other ridge. */}
            {i % 2 === 1 && (
              <div
                ref={el => { fogs.current[i] = el; }}
                className="absolute inset-x-[-20%] top-[22%] h-[30%] animate-fog rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgb(196_181_253/0.16),transparent_70%)] blur-2xl will-change-transform"
                style={{ animationDelay: `${-i * 7}s`, animationDuration: `${38 + i * 6}s` }}
              />
            )}
          </div>
        ))}
      </div>

      {dim > 0 && <div className="absolute inset-0 bg-night-950" style={{ opacity: dim }} />}
      {/* Blend the art into the page colour below it. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night-900" />
    </div>
  );
});

export default MountainScene;
