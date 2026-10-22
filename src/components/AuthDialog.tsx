import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth.tsx';
import { errorMessage } from '../lib/api.ts';
import { useNameCheck } from '../lib/useNameCheck.ts';
import { NAME_MAX, PASSWORD_MIN } from '../../shared/validation.ts';
import Button from './Button.tsx';
import Field from './Field.tsx';
import Modal from './Modal.tsx';
import NameHint from './NameHint.tsx';
import Spinner from './Spinner.tsx';

export type AuthMode = 'login' | 'signup';

interface AuthDialogProps {
  mode: AuthMode | null;
  onModeChange: (mode: AuthMode | null) => void;
}

export default function AuthDialog({ mode, onModeChange }: AuthDialogProps) {
  const { login, signup } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const nameStatus = useNameCheck(mode === 'signup' ? name : '');

  useEffect(() => {
    setError('');
    setBusy(false);
  }, [mode]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await signup(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';
  const nameBlocked = isSignup && (nameStatus.state === 'taken' || nameStatus.state === 'invalid');

  return (
    <Modal
      open={mode !== null}
      onClose={() => onModeChange(null)}
      title={isSignup ? 'Create your account' : 'Welcome back'}
      subtitle={isSignup ? 'And enter a whole new world.' : 'Sign in to hop back into the conversation.'}
    >
      <form key={mode} onSubmit={onSubmit} className="space-y-4">
        {isSignup && (
          <Field
            label="Display name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="username"
            required
            maxLength={NAME_MAX}
            placeholder="What should people call you?"
            autoFocus
            hint={<NameHint status={nameStatus} />}
          />
        )}
        <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" autoFocus={!isSignup} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? PASSWORD_MIN : undefined}
          placeholder={isSignup ? `At least ${PASSWORD_MIN} characters` : '••••••••'}
        />

        <p role="alert" className="min-h-5 text-sm font-medium text-live">{error}</p>

        <Button type="submit" size="lg" className="w-full" disabled={busy || nameBlocked}>
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
    </Modal>
  );
}
