import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * A member's totals for their profile, readable by every approved member:
 *
 *   memberStats/{uid}  { eventsAttended, serviceHours, updatedAt }
 *
 * Attendance itself stays private to the member and officers; only these two numbers are
 * shared. Recounted from the member's check-ins after every check-in change, and nightly
 * for everyone so the totals heal if an event is deleted.
 */
export type MemberStats = { eventsAttended: number; serviceHours: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Recounts one member's events attended and service hours from their check-ins. */
export async function recountMemberStats(
  uid: string,
  db: Firestore = getFirestore(),
): Promise<MemberStats> {
  // A member has at most a few hundred check-ins, so reading them is cheap and lets
  // malformed hours be skipped.
  const snap = await db.collectionGroup('attendance').where('memberId', '==', uid).get();
  let hours = 0;
  for (const d of snap.docs) {
    const h = d.get('serviceHours');
    if (typeof h === 'number' && Number.isFinite(h) && h > 0) hours += h;
  }
  const stats = { eventsAttended: snap.size, serviceHours: round1(hours) };
  await db.doc(`memberStats/${uid}`).set({ ...stats, updatedAt: FieldValue.serverTimestamp() });
  return stats;
}

/** Recounts every approved member. Returns how many it updated. */
export async function recountAllMemberStats(db: Firestore = getFirestore()): Promise<number> {
  const members = await db.collection('members').where('status', '==', 'approved').get();
  for (const m of members.docs) await recountMemberStats(m.id, db);
  return members.size;
}

export const memberStatsOnCheckIn = onDocumentWritten(
  'events/{eventId}/attendance/{uid}',
  async (event) => {
    await recountMemberStats(event.params.uid);
  },
);

export const memberStatsNightly = onSchedule('every 24 hours', async () => {
  const updated = await recountAllMemberStats();
  logger.info('Member stats recounted', { updated });
});
