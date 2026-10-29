import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { subscribeToOwnMember, type MemberSummary } from '@/data/members';

import { useAuth, type AuthStatus } from './AuthProvider';

/**
 * Where the person stands overall. Decides which part of the app they can see.
 *
 * - signedOut: auth screens
 * - unverified: check your email
 * - needsProfile: signed in and verified, but no member profile was saved
 * - pending: waiting for an officer
 * - declined: an officer said no
 * - approved: the whole app
 * - error: the profile couldn't be loaded (usually offline)
 */
export type SessionStatus =
  | 'loading'
  | 'signedOut'
  | 'unverified'
  | 'needsProfile'
  | 'pending'
  | 'declined'
  | 'approved'
  | 'error';

/**
 * Pure: combines auth state and the member profile. `member` is undefined while loading,
 * null when there is no profile.
 */
export function toSessionStatus(
  auth: AuthStatus,
  member: MemberSummary | null | undefined,
  failed = false,
): SessionStatus {
  if (auth !== 'signedIn') return auth;
  if (member === undefined) return failed ? 'error' : 'loading';
  if (member === null) return 'needsProfile';
  return member.status;
}

export type Session = {
  status: SessionStatus;
  member: MemberSummary | null;
  /** Try loading the profile again after an error. */
  retry: () => void;
};

const SessionContext = createContext<Session>({
  status: 'loading',
  member: null,
  retry: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : null;
  const [attempt, setAttempt] = useState(0);
  // Results are tagged with the user and attempt they belong to, so a stale result from a
  // previous account or attempt is ignored without resetting state inside the effect.
  const key = uid ? `${uid}:${attempt}` : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    member?: MemberSummary | null;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!uid || !key) return;
    return subscribeToOwnMember(
      uid,
      (next) => setLoaded({ key, member: next, failed: false }),
      () =>
        setLoaded((prev) => ({
          key,
          member: prev?.key === key ? prev.member : undefined,
          failed: true,
        })),
    );
  }, [uid, key]);

  const current = loaded && loaded.key === key ? loaded : null;
  const member = current?.member;
  const failed = current?.failed ?? false;

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<Session>(
    () => ({
      status: toSessionStatus(auth.status, uid ? member : null, failed),
      member: member ?? null,
      retry,
    }),
    [auth.status, uid, member, failed, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Live session for the signed-in person. Updates the moment an officer approves them. */
export function useSession(): Session {
  return useContext(SessionContext);
}
