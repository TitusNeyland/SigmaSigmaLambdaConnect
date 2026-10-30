import { useEffect, useState } from 'react';

import { subscribeToBlocked } from '@/data/blocks';
import { subscribeToHidden } from '@/data/reports';

/** Who the member blocked and what they reported, live. Both are hidden from them. */
export function useHiddenContent(uid: string) {
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!uid) return;
    const stopBlocked = subscribeToBlocked(
      uid,
      (accounts) => setBlocked(new Set(accounts.map((a) => a.uid))),
      () => {},
    );
    const stopHidden = subscribeToHidden(uid, setHidden, () => {});
    return () => {
      stopBlocked();
      stopHidden();
    };
  }, [uid]);
  return { blocked, hidden };
}
