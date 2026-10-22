const sizes = {
  xs: 'size-7',
  sm: 'size-9',
  md: 'size-12',
  lg: 'size-20 sm:size-24',
  xl: 'size-28 sm:size-32',
};

interface AvatarProps {
  /** The user's fixed avatar seed (assigned at signup). */
  seed: string;
  size?: keyof typeof sizes;
  speaking?: boolean;
  className?: string;
}

export default function Avatar({ seed, size = 'sm', speaking = false, className = '' }: AvatarProps) {
  return (
    <img
      src={`/api/avatars/${encodeURIComponent(seed)}.svg`}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      className={[
        'shrink-0 select-none rounded-full bg-white/10 object-cover transition-shadow duration-200',
        speaking ? 'shadow-[0_0_0_3px_var(--color-night-900),0_0_0_6px_var(--color-speak),0_0_28px_4px_rgb(74_222_128/0.45)]' : '',
        sizes[size],
        className,
      ].join(' ')}
    />
  );
}
