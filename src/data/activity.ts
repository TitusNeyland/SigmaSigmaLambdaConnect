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
 * Activity, behind the heart on Home: likes, comments and replies on the member's posts,
 * being tagged, new announcements, event reminders and being approved. Cloud Functions
 * write the items (functions/src/activity.ts); only the member reads them.
 */
export type ActivityType =
  'like' | 'comment' | 'reply' | 'tag' | 'announcement' | 'event_reminder' | 'approved';

export type ActivityItem = {
  id: string;
  type: ActivityType;
  /** Who did it. Empty for the chapter's own notices (reminders, approval). */
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  /** The post, for likes, comments, replies and tags. */
  postId: string | null;
  commentId: string | null;
  /** The comment, reply or tagged post's caption, trimmed. */
  text: string;
  /** The post's first photo, for the thumbnail. Null for text posts. */
  photoPath: string | null;
  eventId: string | null;
  announcementId: string | null;
  /** An announcement's or event's title. */
  title: string;
  /** When a reminded event starts. */
  startsAt: Date | null;
  at: Date;
};

/** Types about one of the member's posts, or a post they were tagged in. */
const POST_TYPES: readonly ActivityType[] = ['like', 'comment', 'reply', 'tag'];

/** How many recent items Activity shows. */
export const ACTIVITY_LIMIT = 50;

const TYPES: readonly ActivityType[] = [
  'like',
  'comment',
  'reply',
  'tag',
  'announcement',
  'event_reminder',
  'approved',
];
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function toActivityItem(id: string, data: DocumentData): ActivityItem | null {
  const type = data.type as ActivityType;
  const actorId = str(data.actorId);
  const postId = str(data.postId) || null;
  const eventId = str(data.eventId) || null;
  const announcementId = str(data.announcementId) || null;
  if (!TYPES.includes(type) || !(data.at instanceof Timestamp)) return null;
  // Each kind needs what it points at, and people's actions need who did them.
  if (POST_TYPES.includes(type) && (!postId || !actorId)) return null;
  if (type === 'announcement' && !announcementId) return null;
  if (type === 'event_reminder' && !eventId) return null;
  return {
    id,
    type,
    actorId,
    actorName: str(data.actorName) || (actorId ? 'A brother' : ''),
    actorPhotoURL: str(data.actorPhotoURL) || null,
    postId,
    commentId: str(data.commentId) || null,
    text: str(data.text),
    photoPath: str(data.photoPath) || null,
    eventId,
    announcementId,
    title: str(data.title),
    startsAt: data.startsAt instanceof Timestamp ? data.startsAt.toDate() : null,
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
