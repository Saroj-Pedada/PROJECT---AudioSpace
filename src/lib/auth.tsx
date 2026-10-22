import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../../shared/protocol.ts';
import { api, ApiError } from './api.ts';

interface AuthContextValue {
  /** undefined while the session is being checked, null when signed out. */
  user: User | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  enterAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api.get<User>('/api/me')
      .then(setUser)
      .catch(err => {
        if (!(err instanceof ApiError)) console.error(err);
        setUser(null);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.post<User>('/api/auth/login', { email, password }));
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setUser(await api.post<User>('/api/auth/signup', { name, email, password }));
  }, []);

  const enterAsGuest = useCallback(async () => {
    setUser(await api.post<User>('/api/auth/guest'));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, signup, enterAsGuest, logout }),
    [user, login, signup, enterAsGuest, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
