import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from './firebase';
import { parseRoleDoc } from './roles';
import type { RoleDoc } from './types';

/** Who wrote a post, as the author line shows them. */
export type FeedAuthor = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  headline: string;
  initiationTerm: string;
  role: RoleDoc | null;
};

export type FeedPost = {
  id: string;
  authorId: string;
  /** Null when the author's profile is gone. */
  author: FeedAuthor | null;
  caption: string;
  /** Storage paths, in order. */
  photoPaths: string[];
  eventId: string | null;
  allowComments: boolean;
  official: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  /** Whether the signed-in member liked it. */
  likedByMe: boolean;
};

/** Opaque: pass it back to get the next page. Null when there are no more posts. */
export type FeedCursor = QueryDocumentSnapshot | null;

export type FeedPage = { posts: FeedPost[]; cursor: FeedCursor };

export const PAGE_SIZE = 10;

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const count = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0);

/** Authors are looked up once per member, however many of their posts are on the page. */
async function fetchAuthor(uid: string): Promise<FeedAuthor | null> {
  const [member, role] = await Promise.all([
    getDoc(doc(db, 'members', uid)),
    getDoc(doc(db, 'roles', uid)),
  ]);
  if (!member.exists()) return null;
  const data = member.data();
  const displayName = text(data.displayName).trim();
  if (!displayName) return null;
  return {
    uid,
    displayName,
    photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
    headline: text(data.headline).trim(),
    initiationTerm: text(data.initiationTerm).trim(),
    role: role.exists() ? parseRoleDoc(role.data()) : null,
  };
}

export function toFeedPost(
  id: string,
  data: Record<string, unknown>,
  author: FeedAuthor | null,
  likedByMe: boolean,
): FeedPost | null {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null;
  const authorId = text(data.authorId);
  if (!createdAt || !authorId) return null;
  return {
    id,
    authorId,
    author,
    caption: text(data.caption),
    photoPaths: Array.isArray(data.photoPaths)
      ? data.photoPaths.filter((p): p is string => typeof p === 'string' && p !== '')
      : [],
    eventId: typeof data.eventId === 'string' && data.eventId ? data.eventId : null,
    allowComments: data.allowComments !== false,
    official: data.official === true,
    likeCount: count(data.likeCount),
    commentCount: count(data.commentCount),
    createdAt,
    likedByMe,
  };
}

/**
 * One page of the chapter feed, newest first. Removed posts are never asked for (the rules
 * hide them anyway). Hiding blocked authors happens on the screen, from the block list.
 */
export async function fetchFeedPage(
  uid: string,
  cursor: FeedCursor = null,
  pageSize = PAGE_SIZE,
): Promise<FeedPage> {
  const snap = await getDocs(
    query(
      collection(db, 'posts'),
      where('removed', '==', false),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(pageSize),
    ),
  );

  const authorIds = [...new Set(snap.docs.map((d) => text(d.data().authorId)).filter(Boolean))];
  const authors = new Map(
    await Promise.all(authorIds.map(async (id) => [id, await fetchAuthor(id)] as const)),
  );
  const posts = await Promise.all(
    snap.docs.map(async (d) => {
      const liked = await getDoc(doc(db, 'posts', d.id, 'likes', uid));
      return toFeedPost(
        d.id,
        d.data(),
        authors.get(text(d.data().authorId)) ?? null,
        liked.exists(),
      );
    }),
  );
  return {
    posts: posts.filter((p): p is FeedPost => p !== null),
    cursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
  };
}
