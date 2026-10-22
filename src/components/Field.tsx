import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
}

export const inputClasses =
  'h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-[15px] text-white placeholder:text-white/35 transition outline-none focus:border-accent focus:bg-black/35 focus:ring-4 focus:ring-accent/20 disabled:opacity-60';

export default function Field({ label, hint, type, className = '', ...props }: FieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold tracking-wider text-white/60 uppercase">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? 'text' : type}
          className={`${inputClasses} ${isPassword ? 'pr-12' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            className="absolute top-1.5 right-1.5 grid size-9 cursor-pointer place-items-center rounded-lg text-white/50 hover:text-white"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        )}
      </div>
      {hint && <div className="text-xs text-white/50">{hint}</div>}
    </div>
  );
}
