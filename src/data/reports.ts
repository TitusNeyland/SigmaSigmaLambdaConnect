import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { db } from './firebase';
import type { ReportReason } from './types';

export { REPORT_REASONS, type ReportReason } from './types';

/**
 * Reports a member to the officers' queue (#50). Only officers can read reports, so the
 * reporter stays anonymous to the person reported.
 */
export async function reportMember(
  reporterId: string,
  memberId: string,
  reason: ReportReason,
): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    targetType: 'member',
    targetAuthorId: memberId,
    reason,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}
