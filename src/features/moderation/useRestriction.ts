import { useEffect, useState } from 'react';

import { fetchMyRestriction } from '@/data/moderation';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Officers paused your posting and commenting until Nov 5." */
export function restrictionNote(until: Date): string {
  return `Officers paused your posting and commenting until ${MONTHS[until.getMonth()]} ${until.getDate()}.`;
}

/**
 * When the signed-in member can post again, if officers paused them (#50). Null when they
 * can post. The rules enforce it either way; this just explains why Share is off.
 */
export function useRestriction(uid: string): Date | null {
  const [until, setUntil] = useState<{ uid: string; date: Date | null } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    fetchMyRestriction(uid).then(
      (date) => live && setUntil({ uid, date }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [uid]);
  return until?.uid === uid ? until.date : null;
}
