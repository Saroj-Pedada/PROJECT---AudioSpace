import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../lib/auth.tsx';
import Button from './Button.tsx';
import Spinner from './Spinner.tsx';

export type AuthMode = 'login' | 'signup';

interface AuthDialogProps {
  mode: AuthMode | null;
  onModeChange: (mode: AuthMode | null) => void;
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-white/60">{label}</label>
      <input
        id={id}
        className="h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-[15px] text-white placeholder:text-white/35 transition outline-none focus:border-accent focus:bg-black/35 focus:ring-4 focus:ring-accent/20"
        {...props}
      />
    </div>
  );
}

export default function AuthDialog({ mode, onModeChange }: AuthDialogProps) {
  const { login, signup } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
    setError('');
  }, [mode]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await signup(String(form.get('name')), email, password);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onModeChange(null)}
      onClick={e => e.target === dialogRef.current && onModeChange(null)}
      className="m-auto w-[min(440px,calc(100vw-2rem))] overflow-visible bg-transparent p-0 text-white backdrop:bg-night-950/70 backdrop:backdrop-blur-sm open:animate-rise"
    >
      <div className="glass relative rounded-3xl bg-night-800/80 p-7 sm:p-9">
        <button
          type="button"
          onClick={() => onModeChange(null)}
          className="absolute top-4 right-4 grid size-9 cursor-pointer place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <h2 className="text-3xl font-extrabold">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="mt-1.5 text-sm text-white/60">
          {isSignup ? 'And enter a whole new world.' : 'Sign in to hop back into the conversation.'}
        </p>

        <form key={mode} onSubmit={onSubmit} className="mt-7 space-y-4">
          {isSignup && <Field label="Name" name="name" autoComplete="name" required maxLength={40} placeholder="What should people call you?" autoFocus />}
          <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" autoFocus={!isSignup} />
          <div className="relative">
            <Field
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              minLength={isSignup ? 8 : undefined}
              placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-2 bottom-1.5 grid size-9 cursor-pointer place-items-center rounded-lg text-white/50 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>

          <p role="alert" className="min-h-5 text-sm font-medium text-live">{error}</p>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">
          {isSignup ? 'Already have an account?' : 'New to AudioSpace?'}{' '}
          <button
            type="button"
            onClick={() => onModeChange(isSignup ? 'login' : 'signup')}
            className="cursor-pointer font-semibold text-white underline-offset-4 hover:underline"
          >
            {isSignup ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </dialog>
  );
}
