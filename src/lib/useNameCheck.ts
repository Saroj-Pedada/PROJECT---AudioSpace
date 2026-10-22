import { useEffect, useState } from 'react';
import { normalizeName, validateName } from '../../shared/validation.ts';
import { api } from './api.ts';

export type NameStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'invalid'; message: string }
  | { state: 'taken' }
  | { state: 'available' };

/** Checks a display name as the user types: format first, then availability (debounced). */
export function useNameCheck(raw: string, currentName?: string): NameStatus {
  const [status, setStatus] = useState<NameStatus>({ state: 'idle' });

  useEffect(() => {
    const name = normalizeName(raw);
    if (!name || name.toLowerCase() === currentName?.toLowerCase()) {
      setStatus({ state: 'idle' });
      return;
    }
    const error = validateName(name);
    if (error) {
      setStatus({ state: 'invalid', message: error });
      return;
    }

    setStatus({ state: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.get<{ available: boolean }>(`/api/users/name-available?name=${encodeURIComponent(name)}`)
        .then(({ available }) => !controller.signal.aborted && setStatus({ state: available ? 'available' : 'taken' }))
        .catch(() => !controller.signal.aborted && setStatus({ state: 'idle' }));
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [raw, currentName]);

  return status;
}
