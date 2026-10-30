import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

import { db } from './firebase';

export type ChapterAnnouncement = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorTitle: string;
  pinned: boolean;
  createdAt: Date;
};

/** The hub shows the latest; older ones drop off. */
export const MAX_ANNOUNCEMENTS = 30;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function toAnnouncement(
  id: string,
  data: Record<string, unknown>,
): ChapterAnnouncement | null {
  const title = text(data.title);
  if (!title) return null;
  return {
    id,
    title,
    body: text(data.body),
    authorId: text(data.authorId),
    authorTitle: text(data.authorTitle),
    pinned: data.pinned === true,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  };
}

/** Live list, newest first. The screen puts pinned ones on top. */
export function subscribeToAnnouncements(
  onChange: (list: ChapterAnnouncement[]) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(MAX_ANNOUNCEMENTS)),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => toAnnouncement(d.id, d.data()))
          .filter((a): a is ChapterAnnouncement => a !== null),
      ),
    onError,
  );
}

/** Live set of announcement IDs this member has read. */
export function subscribeToReads(
  uid: string,
  onChange: (ids: ReadonlySet<string>) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, 'reads', uid, 'announcements'),
    (snap) => onChange(new Set(snap.docs.map((d) => d.id))),
    onError,
  );
}

export async function markRead(uid: string, announcementId: string): Promise<void> {
  await setDoc(doc(db, 'reads', uid, 'announcements', announcementId), {
    readAt: serverTimestamp(),
  });
}

export type NewAnnouncement = { title: string; body: string; pinned: boolean; authorTitle: string };

/** Officers only; the rules enforce it. A Cloud Function pushes it to every member. */
export async function postAnnouncement(uid: string, input: NewAnnouncement): Promise<void> {
  await addDoc(collection(db, 'announcements'), {
    title: input.title.trim(),
    body: input.body.trim(),
    authorId: uid,
    ...(input.authorTitle.trim() ? { authorTitle: input.authorTitle.trim() } : {}),
    pinned: input.pinned,
    createdAt: serverTimestamp(),
  });
}
