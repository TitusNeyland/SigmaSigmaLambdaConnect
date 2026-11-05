import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';

import { db } from './firebase';

/**
 * Activity: likes, comments and replies on the member's posts, behind the heart on Home.
 * Cloud Functions write the items (functions/src/activity.ts); only the member reads them.
 */
export type ActivityType = 'like' | 'comment' | 'reply';

export type ActivityItem = {
  id: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  postId: string;
  commentId: string | null;
  /** The comment or reply, trimmed. Empty for likes. */
  text: string;
  /** The post's first photo, for the thumbnail. Null for text posts. */
  photoPath: string | null;
  at: Date;
};

/** How many recent items Activity shows. */
export const ACTIVITY_LIMIT = 50;

const TYPES: readonly ActivityType[] = ['like', 'comment', 'reply'];
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function toActivityItem(id: string, data: DocumentData): ActivityItem | null {
  const type = data.type as ActivityType;
  const actorId = str(data.actorId);
  const postId = str(data.postId);
  if (!TYPES.includes(type) || !actorId || !postId || !(data.at instanceof Timestamp)) {
    return null;
  }
  return {
    id,
    type,
    actorId,
    actorName: str(data.actorName) || 'A brother',
    actorPhotoURL: str(data.actorPhotoURL) || null,
    postId,
    commentId: str(data.commentId) || null,
    text: str(data.text),
    photoPath: str(data.photoPath) || null,
    at: data.at.toDate(),
  };
}

/** The member's newest activity first. */
export async function fetchActivity(uid: string, max = ACTIVITY_LIMIT): Promise<ActivityItem[]> {
  const snap = await getDocs(
    query(collection(db, 'activity', uid, 'items'), orderBy('at', 'desc'), limit(max)),
  );
  return snap.docs
    .map((d) => toActivityItem(d.id, d.data()))
    .filter((i): i is ActivityItem => i !== null);
}

/** When the member last opened Activity, or null if never. */
export async function fetchActivitySeen(uid: string): Promise<Date | null> {
  const seen = (await getDoc(doc(db, 'activity', uid))).get('seenAt');
  return seen instanceof Timestamp ? seen.toDate() : null;
}

/** Records that the member just looked, which clears the dot on the heart. */
export async function markActivitySeen(uid: string): Promise<void> {
  await setDoc(doc(db, 'activity', uid), { seenAt: serverTimestamp() });
}
