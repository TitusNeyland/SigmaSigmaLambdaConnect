import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

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

/** A post or comment someone reported. */
export type ContentReport = {
  targetType: 'post' | 'comment';
  postId: string;
  commentId?: string;
  /** Who wrote it, so officers can see patterns and restrict posting (#50). */
  targetAuthorId: string;
  reason: ReportReason;
};

/** The key a hidden post or comment is stored under. */
export const hiddenKey = (r: Pick<ContentReport, 'targetType' | 'postId' | 'commentId'>) =>
  r.targetType === 'post' ? `post_${r.postId}` : `comment_${r.postId}_${r.commentId}`;

/**
 * Reports a post or comment to the officers' queue and hides it for the reporter, in one
 * write. Reports are readable by officers only, so the author never learns who reported.
 */
export async function reportContent(reporterId: string, report: ContentReport): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'reports')), {
    reporterId,
    targetType: report.targetType,
    postId: report.postId,
    ...(report.commentId ? { commentId: report.commentId } : {}),
    targetAuthorId: report.targetAuthorId,
    reason: report.reason,
    status: 'open',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'hidden', reporterId, 'items', hiddenKey(report)), {
    targetType: report.targetType,
    postId: report.postId,
    ...(report.commentId ? { commentId: report.commentId } : {}),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Live set of what this member reported and so no longer sees (keys from hiddenKey). */
export function subscribeToHidden(
  uid: string,
  onChange: (keys: ReadonlySet<string>) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, 'hidden', uid, 'items'),
    (snap) => onChange(new Set(snap.docs.map((d) => d.id))),
    onError,
  );
}
