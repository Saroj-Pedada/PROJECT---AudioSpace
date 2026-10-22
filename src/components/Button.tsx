import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'glass' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent-strong text-white shadow-lg shadow-accent/30 hover:bg-accent',
  glass: 'border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20',
  ghost: 'text-white/80 hover:bg-white/10 hover:text-white',
  danger: 'border border-live/40 bg-live/15 text-white hover:bg-live/25',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-sm',
  md: 'h-11 gap-2 px-5 text-sm',
  lg: 'h-13 gap-2 px-7 text-base',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return [
    'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-semibold transition',
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  ].join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
