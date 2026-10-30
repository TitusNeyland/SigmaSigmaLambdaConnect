import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from './firebase';
import { REPORT_REASONS, type ReportReason } from './types';

export type ReportAction = 'kept' | 'removed' | 'restricted';
/** Must match RESTRICT_DAYS in functions/src/moderation.ts. */
export const RESTRICT_DAYS = 7;

/** Open reports about one post, comment or member, grouped into a single card. */
export type ReportCase = {
  key: string;
  targetType: 'post' | 'comment' | 'member';
  postId: string | null;
  commentId: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  /** What was reported. Null for a member, or if the content is already gone. */
  preview: { text: string; photoPath: string | null; photoCount: number } | null;
  reasons: { reason: ReportReason; count: number }[];
  /** Anything reporters wrote. Who wrote it isn't shown, so reporters stay anonymous. */
  details: string[];
  count: number;
  latestAt: Date | null;
  reportIds: string[];
};

type RawReport = {
  id: string;
  targetType: ReportCase['targetType'];
  postId: string | null;
  commentId: string | null;
  authorId: string;
  reason: ReportReason;
  details: string;
  createdAt: Date | null;
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const REASONS = new Set(REPORT_REASONS.map((r) => r.value));

function toRaw(id: string, d: Record<string, unknown>): RawReport | null {
  const targetType = d.targetType;
  const authorId = str(d.targetAuthorId);
  if (!authorId || (targetType !== 'post' && targetType !== 'comment' && targetType !== 'member')) {
    return null;
  }
  const postId = str(d.postId);
  const commentId = str(d.commentId);
  if (targetType !== 'member' && !postId) return null;
  if (targetType === 'comment' && !commentId) return null;
  return {
    id,
    targetType,
    postId: targetType === 'member' ? null : postId,
    commentId: targetType === 'comment' ? commentId : null,
    authorId,
    reason: REASONS.has(d.reason as ReportReason) ? (d.reason as ReportReason) : 'other',
    details: typeof d.details === 'string' ? d.details.trim() : '',
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : null,
  };
}

export const caseKey = (r: Pick<RawReport, 'targetType' | 'postId' | 'commentId' | 'authorId'>) =>
  r.targetType === 'member'
    ? `member_${r.authorId}`
    : r.targetType === 'post'
      ? `post_${r.postId}`
      : `comment_${r.postId}_${r.commentId}`;

/** Groups reports by what they're about. Most-reported first, then most recent. */
export function groupReports(
  reports: RawReport[],
): Omit<ReportCase, 'authorName' | 'authorPhotoURL' | 'preview'>[] {
  const byKey = new Map<string, RawReport[]>();
  for (const r of reports) {
    const k = caseKey(r);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  return [...byKey.entries()]
    .map(([key, rs]) => {
      const counts = new Map<ReportReason, number>();
      for (const r of rs) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
      const times = rs.map((r) => r.createdAt?.getTime() ?? 0);
      const latest = Math.max(...times);
      return {
        key,
        targetType: rs[0].targetType,
        postId: rs[0].postId,
        commentId: rs[0].commentId,
        authorId: rs[0].authorId,
        reasons: [...counts.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count),
        details: rs.map((r) => r.details).filter(Boolean),
        count: rs.length,
        latestAt: latest ? new Date(latest) : null,
        reportIds: rs.map((r) => r.id).sort(),
      };
    })
    .sort(
      (a, b) => b.count - a.count || (b.latestAt?.getTime() ?? 0) - (a.latestAt?.getTime() ?? 0),
    );
}

function previewOf(snap: DocumentSnapshot | null): ReportCase['preview'] {
  if (!snap?.exists()) return null;
  const d = snap.data();
  const photos = Array.isArray(d.photoPaths)
    ? d.photoPaths.filter((p): p is string => typeof p === 'string' && p !== '')
    : [];
  return {
    text: typeof d.caption === 'string' ? d.caption : typeof d.text === 'string' ? d.text : '',
    photoPath: photos[0] ?? null,
    photoCount: photos.length,
  };
}

/** Open reports as cards, with a preview of what was reported. Officers only (rules). */
export async function fetchReportQueue(): Promise<ReportCase[]> {
  const snap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'open')));
  const cases = groupReports(
    snap.docs.map((d) => toRaw(d.id, d.data())).filter((r): r is RawReport => r !== null),
  );
  const authorIds = [...new Set(cases.map((c) => c.authorId))];
  const [authors, contents] = await Promise.all([
    Promise.all(authorIds.map((uid) => getDoc(doc(db, 'members', uid)).catch(() => null))),
    Promise.all(
      cases.map((c) =>
        c.targetType === 'post'
          ? getDoc(doc(db, 'posts', c.postId as string)).catch(() => null)
          : c.targetType === 'comment'
            ? getDoc(doc(db, 'posts', c.postId as string, 'comments', c.commentId as string)).catch(
                () => null,
              )
            : Promise.resolve(null),
      ),
    ),
  ]);
  const author = new Map(authorIds.map((uid, i) => [uid, authors[i]]));
  return cases.map((c, i) => {
    const a = author.get(c.authorId);
    const data = a?.exists() ? a.data() : null;
    return {
      ...c,
      authorName: str(data?.displayName) ?? 'Former member',
      authorPhotoURL: str(data?.photoURL),
      preview: previewOf(contents[i]),
    };
  });
}

/** Keeps, removes or restricts. Returns the decision's ID, for undo. */
export async function resolveReportCase(
  reportIds: string[],
  action: ReportAction,
): Promise<string> {
  const result = await httpsCallable<
    { reportIds: string[]; action: ReportAction },
    { decisionId: string }
  >(
    functions,
    'resolveReport',
  )({ reportIds, action });
  return result.data.decisionId;
}

export async function undoReportDecision(decisionId: string): Promise<void> {
  await httpsCallable(functions, 'undoReportDecision')({ decisionId });
}

/** When the member can post again, if an officer paused their posting. */
export async function fetchMyRestriction(uid: string, now = new Date()): Promise<Date | null> {
  const snap = await getDoc(doc(db, 'restrictions', uid));
  if (!snap.exists()) return null;
  const until = snap.data().until;
  if (!(until instanceof Timestamp)) return null;
  const date = until.toDate();
  return date > now ? date : null;
}
