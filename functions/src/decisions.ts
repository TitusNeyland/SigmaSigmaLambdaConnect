import { FieldValue, getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

/**
 * A log of officer decisions in decisions/{id}, readable by officers only and written only
 * here, so nobody can edit the record from the app. Membership decisions (#48) for now;
 * report decisions (#50) go here too.
 */
export type MembershipDecision = {
  kind: 'membership';
  subjectId: string;
  subjectName: string;
  decision: 'approved' | 'declined';
  by: string | null;
  at: Timestamp | FieldValue;
};

/** The log entry for a member's status change, or null if it wasn't an officer decision. */
export function membershipDecision(
  uid: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): MembershipDecision | null {
  const from = before?.status;
  const to = after?.status;
  if (from === to || (to !== 'approved' && to !== 'declined')) return null;
  return {
    kind: 'membership',
    subjectId: uid,
    subjectName: typeof after?.displayName === 'string' ? after.displayName : '',
    decision: to,
    by: typeof after?.reviewedBy === 'string' ? after.reviewedBy : null,
    at: after?.reviewedAt instanceof Timestamp ? after.reviewedAt : FieldValue.serverTimestamp(),
  };
}

/** Writes the entry. Keyed by the trigger's event ID, so a retried trigger can't log twice. */
export async function logMembershipDecision(
  db: Firestore,
  eventId: string,
  uid: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): Promise<boolean> {
  const entry = membershipDecision(uid, before, after);
  if (!entry) return false;
  await db.doc(`decisions/${eventId}`).set(entry);
  return true;
}

export const logMemberDecision = onDocumentUpdated('members/{uid}', async (event) => {
  await logMembershipDecision(
    getFirestore(),
    event.id,
    event.params.uid,
    event.data?.before.data(),
    event.data?.after.data(),
  );
});
