import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from './firebase';

/** Someone who signed up and is waiting for an officer. */
export type MembershipRequest = {
  uid: string;
  displayName: string;
  initiationTerm: string;
  photoURL: string | null;
  requestedAt: Date | null;
};

export type Decision = 'approved' | 'declined';

/** Pending sign-ups, oldest first so nobody waits longest. Officers only (rules). */
export async function fetchPendingRequests(): Promise<MembershipRequest[]> {
  const snap = await getDocs(query(collection(db, 'members'), where('status', '==', 'pending')));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: typeof data.displayName === 'string' ? data.displayName : '',
        initiationTerm: typeof data.initiationTerm === 'string' ? data.initiationTerm : '',
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
        requestedAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
      };
    })
    .sort(
      (a, b) =>
        (a.requestedAt?.getTime() ?? Infinity) - (b.requestedAt?.getTime() ?? Infinity) ||
        a.displayName.localeCompare(b.displayName),
    );
}

/**
 * Approves or declines a sign-up. The rules check it's an officer, recording who and when;
 * a Cloud Function logs the decision and tells the member they're in.
 */
export async function decideRequest(uid: string, officerUid: string, decision: Decision) {
  await updateDoc(doc(db, 'members', uid), {
    status: decision,
    reviewedBy: officerUid,
    reviewedAt: serverTimestamp(),
  });
}
