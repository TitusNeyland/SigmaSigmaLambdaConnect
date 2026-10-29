import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { refreshUser, subscribeToAuth, type AuthUser } from '@/data/auth';

export type AuthStatus = 'loading' | 'signedOut' | 'unverified' | 'signedIn';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'unverified'; user: AuthUser }
  | { status: 'signedIn'; user: AuthUser };

export type AuthContextValue = AuthState & {
  /** Reloads the user, e.g. after they tap the link in the verification email. */
  refresh: () => Promise<AuthStatus>;
};

/** Where a Firebase user stands. Pure, so the gate logic is easy to test. */
export function toAuthState(user: AuthUser | null): AuthState {
  if (!user) return { status: 'signedOut', user: null };
  return user.emailVerified ? { status: 'signedIn', user } : { status: 'unverified', user };
}

const AuthContext = createContext<AuthContextValue>({
  status: 'loading',
  user: null,
  refresh: async () => 'loading',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => subscribeToAuth((user) => setState(toAuthState(user))), []);

  const refresh = useCallback(async () => {
    const next = toAuthState(await refreshUser());
    setState(next);
    return next.status;
  }, []);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
