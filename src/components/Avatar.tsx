function hueOf(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2);
  return initials.toUpperCase();
}

const sizes = {
  xs: 'size-7 text-[0.65rem] ring-2',
  sm: 'size-9 text-xs ring-2',
  lg: 'size-20 text-2xl sm:size-24 sm:text-3xl',
};

interface AvatarProps {
  name: string;
  size?: keyof typeof sizes;
  speaking?: boolean;
  className?: string;
}

export default function Avatar({ name, size = 'sm', speaking = false, className = '' }: AvatarProps) {
  const hue = hueOf(name);
  return (
    <div
      aria-hidden
      className={[
        'relative grid shrink-0 select-none place-items-center rounded-full font-bold text-white ring-night-900',
        'transition-shadow duration-200',
        speaking ? 'shadow-[0_0_0_3px_var(--color-night-900),0_0_0_6px_var(--color-speak),0_0_28px_4px_rgb(74_222_128/0.45)]' : '',
        sizes[size],
        className,
      ].join(' ')}
      style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 75% 62%), hsl(${(hue + 50) % 360} 70% 42%))` }}
    >
      {initialsOf(name)}
    </div>
  );
}
