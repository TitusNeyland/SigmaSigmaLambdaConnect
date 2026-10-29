import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useSession } from '@/features/auth/session';

import { registerForPush } from './registerForPush';

/**
 * Registers this phone for push once someone is signed in with a profile: pending members
 * too, so they hear the moment an officer approves them. Never at first launch.
 */
export function PushRegistration() {
  const auth = useAuth();
  const { status } = useSession();
  const uid = auth.status === 'signedIn' ? auth.user.uid : '';
  const ready = status === 'pending' || status === 'approved';

  useEffect(() => {
    if (uid && ready) registerForPush(uid).catch(() => {});
  }, [uid, ready]);

  return null;
}
