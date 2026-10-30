import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { isApprovedOfficer } from './kpis.js';
import { sendPush, type PushDeps, type PushMessage } from './push.js';

/**
 * Officers act on reports (#50). Everything happens here rather than in the app so each
 * decision is one atomic change, logged in decisions/{id} with the officer's name, and can
 * be undone exactly.
 */

export type ReportAction = 'kept' | 'removed' | 'restricted';
export const ACTIONS: readonly ReportAction[] = ['kept', 'removed', 'restricted'];
/** Restrict pauses posting and commenting for this long. */
export const RESTRICT_DAYS = 7;
const DAY = 86_400_000;

type Target = {
  targetType: 'post' | 'comment' | 'member';
  postId: string | null;
  commentId: string | null;
  targetAuthorId: string;
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export function targetOf(report: Record<string, unknown>): Target | null {
  const targetType = report.targetType;
  const targetAuthorId = str(report.targetAuthorId);
  if (!targetAuthorId) return null;
  if (targetType === 'member') {
    return { targetType, postId: null, commentId: null, targetAuthorId };
  }
  const postId = str(report.postId);
  if (!postId) return null;
  if (targetType === 'post') return { targetType, postId, commentId: null, targetAuthorId };
  if (targetType === 'comment') {
    const commentId = str(report.commentId);
    return commentId ? { targetType, postId, commentId, targetAuthorId } : null;
  }
  return null;
}

export const sameTarget = (a: Target, b: Target) =>
  a.targetType === b.targetType &&
  a.postId === b.postId &&
  a.commentId === b.commentId &&
  a.targetAuthorId === b.targetAuthorId;

/** What the reporters hear. They're never told who decided. */
export function reporterMessage(action: ReportAction, target: Target): PushMessage {
  const what =
    target.targetType === 'member'
      ? 'the member you reported'
      : `the ${target.targetType} you reported`;
  const body =
    action === 'removed'
      ? `Officers reviewed ${what} and removed it.`
      : action === 'restricted'
        ? `Officers reviewed ${what} and paused their posting for ${RESTRICT_DAYS} days.`
        : `Officers reviewed ${what} and decided it can stay.`;
  return { title: 'Thanks for your report', body, data: { screen: 'home' } };
}

export class ModerationError extends Error {
  constructor(
    readonly code: 'permission-denied' | 'invalid-argument' | 'failed-precondition' | 'not-found',
    message: string,
  ) {
    super(message);
  }
}

async function officerName(db: Firestore, uid: string) {
  const [member, role] = await Promise.all([
    db.doc(`members/${uid}`).get(),
    db.doc(`roles/${uid}`).get(),
  ]);
  return {
    byName: str(member.get('displayName')) ?? '',
    byTitle: str(role.get('title')) ?? (role.get('role') === 'admin' ? 'Admin' : 'Officer'),
  };
}

function contentRef(db: Firestore, t: Target): DocumentReference | null {
  if (t.targetType === 'post') return db.doc(`posts/${t.postId}`);
  if (t.targetType === 'comment') return db.doc(`posts/${t.postId}/comments/${t.commentId}`);
  return null;
}

export type ResolveInput = { reportIds: unknown; action: unknown };

/** Keeps, removes or restricts for a group of open reports about the same thing. */
export async function resolveReports(
  db: Firestore,
  officerUid: string,
  input: ResolveInput,
  deps: PushDeps & { now?: Date } = {},
): Promise<{ decisionId: string }> {
  if (!(await isApprovedOfficer(db, officerUid))) {
    throw new ModerationError('permission-denied', 'Officers only.');
  }
  const action = input.action as ReportAction;
  if (!ACTIONS.includes(action)) throw new ModerationError('invalid-argument', 'Unknown action.');
  const ids = Array.isArray(input.reportIds)
    ? [...new Set(input.reportIds.filter((x): x is string => typeof x === 'string' && x !== ''))]
    : [];
  if (ids.length === 0 || ids.length > 100) {
    throw new ModerationError('invalid-argument', 'Pick the reports to act on.');
  }

  const now = deps.now ?? new Date();
  const at = Timestamp.fromDate(now);
  const who = await officerName(db, officerUid);
  const decisionRef = db.collection('decisions').doc();
  const reportRefs = ids.map((id) => db.doc(`reports/${id}`));

  const { target, reporters } = await db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...reportRefs);
    if (snaps.some((s) => !s.exists)) throw new ModerationError('not-found', 'Report not found.');
    if (snaps.some((s) => s.get('status') !== 'open')) {
      throw new ModerationError('failed-precondition', 'Already handled.');
    }
    const targets = snaps.map((s) => targetOf(s.data() ?? {}));
    const first = targets[0];
    if (!first || targets.some((t) => !t || !sameTarget(t, first))) {
      throw new ModerationError('invalid-argument', 'Those reports are about different things.');
    }
    if (action === 'removed' && first.targetType === 'member') {
      throw new ModerationError('invalid-argument', 'A member can’t be removed. Restrict instead.');
    }

    const decision: Record<string, unknown> = {
      kind: 'report',
      action,
      ...first,
      reportIds: ids,
      by: officerUid,
      ...who,
      at,
    };

    const content = contentRef(db, first);
    const restrictionRef = db.doc(`restrictions/${first.targetAuthorId}`);
    const contentSnap = content && action === 'removed' ? await tx.get(content) : null;
    const previousRestriction = action === 'restricted' ? await tx.get(restrictionRef) : null;

    if (action === 'removed' && content && contentSnap) {
      if (first.targetType === 'post') {
        tx.update(content, { removed: true, updatedAt: at });
      } else if (contentSnap.exists) {
        // Comments have no removed flag, so keep a copy to restore on undo.
        decision.removedComment = contentSnap.data();
        tx.delete(content);
      }
    }
    if (action === 'restricted' && previousRestriction) {
      const until = Timestamp.fromMillis(now.getTime() + RESTRICT_DAYS * DAY);
      decision.restrictedUntil = until;
      decision.previousRestriction = previousRestriction.exists ? previousRestriction.data() : null;
      tx.set(restrictionRef, { until, by: officerUid, decisionId: decisionRef.id, createdAt: at });
    }
    for (const ref of reportRefs) {
      tx.update(ref, {
        status: action,
        resolvedBy: officerUid,
        resolvedAt: at,
        decisionId: decisionRef.id,
      });
    }
    tx.set(decisionRef, decision);
    return {
      target: first,
      reporters: [
        ...new Set(snaps.map((s) => str(s.get('reporterId'))).filter((r): r is string => !!r)),
      ],
    };
  });

  await sendPush(reporters, 'account', reporterMessage(action, target), deps).catch(
    () => undefined,
  );
  return { decisionId: decisionRef.id };
}

/** Puts things back the way they were before a decision. */
export async function undoDecision(
  db: Firestore,
  officerUid: string,
  decisionId: unknown,
  now = new Date(),
): Promise<void> {
  if (!(await isApprovedOfficer(db, officerUid))) {
    throw new ModerationError('permission-denied', 'Officers only.');
  }
  if (typeof decisionId !== 'string' || !decisionId) {
    throw new ModerationError('invalid-argument', 'Which decision?');
  }
  const ref = db.doc(`decisions/${decisionId}`);
  const at = Timestamp.fromDate(now);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('kind') !== 'report') {
      throw new ModerationError('not-found', 'Decision not found.');
    }
    if (snap.get('undone')) throw new ModerationError('failed-precondition', 'Already undone.');
    const d = snap.data() ?? {};
    const target = targetOf(d);
    if (!target) throw new ModerationError('failed-precondition', 'Can’t undo this one.');
    const reportRefs = (Array.isArray(d.reportIds) ? d.reportIds : [])
      .filter((x): x is string => typeof x === 'string')
      .map((id) => db.doc(`reports/${id}`));
    const reports = reportRefs.length ? await tx.getAll(...reportRefs) : [];
    const restrictionRef = db.doc(`restrictions/${target.targetAuthorId}`);
    const restriction = d.action === 'restricted' ? await tx.get(restrictionRef) : null;

    if (d.action === 'removed') {
      if (target.targetType === 'post') {
        tx.update(db.doc(`posts/${target.postId}`), { removed: false, updatedAt: at });
      } else if (target.targetType === 'comment' && d.removedComment) {
        tx.set(db.doc(`posts/${target.postId}/comments/${target.commentId}`), {
          ...(d.removedComment as Record<string, unknown>),
          restoredAt: at,
        });
      }
    }
    // Only lift the restriction this decision set; a newer one stays.
    if (restriction?.exists && restriction.get('decisionId') === decisionId) {
      if (d.previousRestriction) tx.set(restrictionRef, d.previousRestriction);
      else tx.delete(restrictionRef);
    }
    for (const r of reports) {
      if (r.exists && r.get('decisionId') === decisionId) {
        tx.update(r.ref, {
          status: 'open',
          resolvedBy: FieldValue.delete(),
          resolvedAt: FieldValue.delete(),
          decisionId: FieldValue.delete(),
        });
      }
    }
    tx.update(ref, { undone: { by: officerUid, at } });
  });
}

function toHttps(e: unknown): never {
  if (e instanceof ModerationError) throw new HttpsError(e.code, e.message);
  throw e;
}

export const resolveReport = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const data = (request.data ?? {}) as ResolveInput;
  return resolveReports(getFirestore(), request.auth.uid, data).catch(toHttps);
});

export const undoReportDecision = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { decisionId } = (request.data ?? {}) as { decisionId?: unknown };
  await undoDecision(getFirestore(), request.auth.uid, decisionId).catch(toHttps);
  return { ok: true };
});
