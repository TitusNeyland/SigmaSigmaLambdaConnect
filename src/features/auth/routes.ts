import type { SessionStatus } from './session';

/** The screen each session status belongs on. Pure, so the gate is easy to test. */
export function routeForStatus(status: Exclude<SessionStatus, 'loading'>) {
  switch (status) {
    case 'signedOut':
      return '/welcome' as const;
    case 'unverified':
      return '/verify-email' as const;
    case 'needsProfile':
      return '/complete-profile' as const;
    case 'pending':
      return '/pending' as const;
    case 'declined':
      return '/declined' as const;
    case 'error':
      return '/offline' as const;
    case 'approved':
      return '/home' as const;
  }
}
