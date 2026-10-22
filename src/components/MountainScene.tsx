import { useEffect, useRef } from 'react';

// Layer geometry from the original 1920px-wide design: [layer, top, height] inside a 1086px-tall band.
// Layers are listed far to near; farther layers drift more on scroll, so they appear to move slower.
const BAND_HEIGHT = 1086.48;
const LAYERS = [
  [8, 66, 1020.48, 0.5],
  [7, 47, 1022.98, 0.44],
  [6, 103, 924.29, 0.38],
  [5, 128, 897.79, 0.31],
  [4, 0, 937.34, 0.24],
  [3, 229, 785.47, 0.16],
  [2, 328, 708.67, 0.08],
  [1, 304, 762.43, 0],
] as const;

const SKY_DRIFT = 0.6;

interface MountainSceneProps {
  /** Animate the layers as the page scrolls (landing hero). */
  parallax?: boolean;
  /** 'horizon' starts the range part-way down so more sky shows; 'bottom' sits it on the bottom edge. */
  anchor?: 'horizon' | 'bottom';
  className?: string;
}

export default function MountainScene({ parallax = false, anchor = 'bottom', className = '' }: MountainSceneProps) {
  const skyRef = useRef<HTMLImageElement>(null);
  const layerRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    if (!parallax || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.scrollY, window.innerHeight * 1.5);
      if (skyRef.current) skyRef.current.style.transform = `translate3d(0, ${y * SKY_DRIFT}px, 0)`;
      layerRefs.current.forEach((layer, i) => {
        if (layer) layer.style.transform = `translate3d(0, ${y * LAYERS[i][3]}px, 0)`;
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [parallax]);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden bg-night-900 ${className}`}>
      <img
        ref={skyRef}
        src="/images/sky.webp"
        alt=""
        className="absolute inset-x-0 top-0 h-[115%] w-full object-cover object-top will-change-transform"
      />
      <div
        className={`absolute left-1/2 aspect-[1920/1086] w-full min-w-[820px] -translate-x-1/2 ${
          // Start ~a third of the way down, but never leave a gap below the range.
          anchor === 'horizon' ? 'top-[max(34%,calc(100%-max(820px,100vw)*0.5656))]' : 'bottom-0'
        }`}
      >
        {LAYERS.map(([n, top, height], i) => (
          <img
            key={n}
            ref={el => { layerRefs.current[i] = el; }}
            src={`/images/mtn_${n}.webp`}
            alt=""
            className="absolute left-0 w-full will-change-transform"
            style={{ top: `${(top / BAND_HEIGHT) * 100}%`, height: `${(height / BAND_HEIGHT) * 100}%` }}
          />
        ))}
      </div>
      {/* Blend the art into the page colour below it. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night-900" />
    </div>
  );
}
