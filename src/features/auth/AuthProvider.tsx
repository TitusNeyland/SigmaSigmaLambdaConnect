import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { subscribeToAuth, type AuthUser } from '@/data/auth';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: AuthUser };

const AuthContext = createContext<AuthState>({ status: 'loading', user: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(
    () =>
      subscribeToAuth((user) => {
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });
      }),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
