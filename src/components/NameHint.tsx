import { Check, X } from 'lucide-react';
import type { NameStatus } from '../lib/useNameCheck.ts';
import { NAME_MAX, NAME_MIN } from '../../shared/validation.ts';
import Spinner from './Spinner.tsx';

export default function NameHint({ status }: { status: NameStatus }) {
  switch (status.state) {
    case 'checking':
      return <span className="flex items-center gap-1.5"><Spinner className="size-3.5" /> Checking availability…</span>;
    case 'available':
      return <span className="flex items-center gap-1 text-speak"><Check className="size-3.5" /> Available</span>;
    case 'taken':
      return <span className="flex items-center gap-1 text-live"><X className="size-3.5" /> Someone already has this name</span>;
    case 'invalid':
      return <span className="text-live">{status.message}</span>;
    default:
      return <span>Unique, like a username. {NAME_MIN}–{NAME_MAX} characters.</span>;
  }
}
