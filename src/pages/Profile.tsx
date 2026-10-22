import { useState, type FormEvent, type ReactNode } from 'react';
import { CalendarDays, Check, Mail, ShieldCheck } from 'lucide-react';
import { NAME_MAX, PASSWORD_MIN, normalizeName } from '../../shared/validation.ts';
import { errorMessage } from '../lib/api.ts';
import { useAuth, useUser } from '../lib/auth.tsx';
import { useNameCheck } from '../lib/useNameCheck.ts';
import AppShell from '../components/AppShell.tsx';
import Avatar from '../components/Avatar.tsx';
import Button from '../components/Button.tsx';
import Field from '../components/Field.tsx';
import NameHint from '../components/NameHint.tsx';
import Spinner from '../components/Spinner.tsx';

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="glass rounded-3xl p-6 sm:p-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-white/55">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (error) return <p role="alert" className="text-sm font-medium text-live">{error}</p>;
  if (success) return <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-speak"><Check className="size-4" />{success}</p>;
  return null;
}

function DisplayNameForm() {
  const user = useUser();
  const { rename } = useAuth();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const status = useNameCheck(name, user.name);
  const unchanged = normalizeName(name).toLowerCase() === user.name.toLowerCase() && normalizeName(name) === user.name;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await rename(name);
      setSuccess('Display name updated.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Display name" subtitle="This is how people see you in rooms. It's unique, so nobody else can use it.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Display name"
          value={name}
          onChange={e => { setName(e.target.value); setSuccess(''); }}
          maxLength={NAME_MAX}
          autoComplete="username"
          required
          hint={<NameHint status={status} />}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={busy || unchanged || status.state === 'taken' || status.state === 'invalid' || status.state === 'checking'}>
            {busy ? <Spinner /> : 'Save name'}
          </Button>
          <Feedback error={error} success={success} />
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const next = String(form.get('next'));
    if (next !== form.get('confirm')) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await changePassword(String(form.get('current')), next);
      formEl.reset();
      setSuccess('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Reset password" subtitle="Changing your password signs you out everywhere else.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" name="next" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} placeholder={`At least ${PASSWORD_MIN} characters`} />
          <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={busy}>{busy ? <Spinner /> : 'Change password'}</Button>
          <Feedback error={error} success={success} />
        </div>
      </form>
    </Card>
  );
}

export default function Profile() {
  const user = useUser();
  const joined = new Date(`${user.createdAt.replace(' ', 'T')}Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
        <section className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-accent/40 blur-2xl" />
            <Avatar seed={user.avatarSeed} size="xl" className="relative ring-4 ring-white/15" />
          </div>
          <h1 className="mt-5 flex items-center gap-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {user.name}
            {user.isAdmin && <ShieldCheck className="size-6 text-sky-300" aria-label="Admin" />}
          </h1>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-white/55">
            <span className="flex items-center gap-1.5"><Mail className="size-4" />{user.email}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />Joined {joined}</span>
          </div>
          <p className="mt-4 max-w-sm text-xs text-white/40">Your avatar was drawn for you when you signed up. It's yours for good.</p>
        </section>

        <div className="mt-10 space-y-6">
          <DisplayNameForm />
          <PasswordForm />
        </div>
      </main>
    </AppShell>
  );
}
