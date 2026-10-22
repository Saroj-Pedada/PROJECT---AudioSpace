import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../../shared/protocol.ts';
import { api, ApiError } from './api.ts';

interface AuthContextValue {
  /** undefined while the session is being checked, null when signed out. */
  user: User | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  const rename = useCallback(async (name: string) => {
    setUser(await api.patch<User>('/api/me', { name }));
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setUser(await api.post<User>('/api/me/password', { currentPassword, newPassword }));
  }, []);

  const value = useMemo(
    () => ({ user, login, signup, logout, rename, changePassword }),
    [user, login, signup, logout, rename, changePassword],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For pages behind <RequireUser>, where the user is always loaded. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser must be used on a signed-in page');
  return user;
}
