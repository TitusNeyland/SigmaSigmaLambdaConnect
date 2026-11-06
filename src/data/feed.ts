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
import { PREVIEW_COMMENTS, type CommentPreview, type RoleDoc } from './types';

export { PREVIEW_COMMENTS, type CommentPreview };

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
  /** The newest top-level comments, oldest first, shown under the caption in the feed. */
  previewComments: CommentPreview[];
  /** Width over height the photos show at. Posts from before framing are square. */
  aspectRatio: number;
  /** Brothers tagged in it, in the order they were tagged. Deleted profiles are left out. */
  tagged: TaggedMember[];
};

export type TaggedMember = { uid: string; displayName: string };

/** The tagged member IDs on a post document. */
export function taggedIds(data: Record<string, unknown>): string[] {
  return Array.isArray(data.taggedMemberIds)
    ? [...new Set(data.taggedMemberIds.filter((u): u is string => typeof u === 'string' && !!u))]
    : [];
}

/** Looks up tagged brothers' names, leaving out anyone whose profile is gone. */
async function resolveTagged(
  ids: string[],
  authorOf: (uid: string) => Promise<FeedAuthor | null>,
): Promise<TaggedMember[]> {
  const people = await Promise.all(ids.map((id) => authorOf(id).catch(() => null)));
  return people
    .filter((p): p is FeedAuthor => p !== null)
    .map((p) => ({ uid: p.uid, displayName: p.displayName }));
}

/** Opaque: pass it back to get the next page. Null when there are no more posts. */
export type FeedCursor = QueryDocumentSnapshot | null;

export type FeedPage = { posts: FeedPost[]; cursor: FeedCursor };

export const PAGE_SIZE = 10;

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const count = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0);

/** Authors are looked up once per member, however many of their posts are on the page. */
export async function fetchAuthor(uid: string): Promise<FeedAuthor | null> {
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

/** A post's photo shape, kept in the allowed range; square for older posts. */
export function postAspect(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 1;
  return Math.min(1.91, Math.max(0.8, value));
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
    previewComments: [],
    aspectRatio: postAspect(data.aspectRatio),
    tagged: [],
  };
}

/**
 * A post's newest top-level comments, oldest first. Reads a few extra so replies can be
 * skipped. Hiding blocked authors and reported comments happens on the screen.
 */
export async function fetchCommentPreview(
  postId: string,
  authorOf: (uid: string) => Promise<FeedAuthor | null>,
): Promise<CommentPreview[]> {
  const snap = await getDocs(
    query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'desc'),
      limit(PREVIEW_COMMENTS * 3),
    ),
  );
  const newest = snap.docs
    .filter((d) => !d.data().replyToId && text(d.data().text).trim())
    .slice(0, PREVIEW_COMMENTS)
    .reverse();
  return Promise.all(
    newest.map(async (d) => {
      const authorId = text(d.data().authorId);
      const author = authorId ? await authorOf(authorId) : null;
      return {
        id: d.id,
        authorId,
        authorName: author?.displayName ?? 'Former member',
        text: text(d.data().text).trim(),
      };
    }),
  );
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

  // Each person is looked up once per page, whether they posted or commented.
  const authors = new Map<string, Promise<FeedAuthor | null>>();
  const authorOf = (id: string) => {
    if (!authors.has(id)) authors.set(id, fetchAuthor(id));
    return authors.get(id)!;
  };
  const posts = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data();
      const [liked, author, previewComments, tagged] = await Promise.all([
        getDoc(doc(db, 'posts', d.id, 'likes', uid)),
        text(data.authorId) ? authorOf(text(data.authorId)) : Promise.resolve(null),
        // A preview that fails to load just isn't shown; the post still is.
        data.allowComments !== false
          ? fetchCommentPreview(d.id, (id) => authorOf(id).catch(() => null)).catch(() => [])
          : Promise.resolve([]),
        resolveTagged(taggedIds(data), authorOf),
      ]);
      const post = toFeedPost(d.id, data, author, liked.exists());
      return post ? { ...post, previewComments, tagged } : null;
    }),
  );
  return {
    posts: posts.filter((p): p is FeedPost => p !== null),
    cursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
  };
}

/**
 * One post, for its detail screen. Null when it doesn't exist, was removed by officers, or
 * isn't readable.
 */
export async function fetchPost(postId: string, uid: string): Promise<FeedPost | null> {
  const [snap, liked] = await Promise.all([
    getDoc(doc(db, 'posts', postId)),
    getDoc(doc(db, 'posts', postId, 'likes', uid)),
  ]);
  if (!snap.exists() || snap.data().removed === true) return null;
  const data = snap.data();
  const [author, tagged] = await Promise.all([
    fetchAuthor(text(data.authorId)),
    resolveTagged(taggedIds(data), fetchAuthor),
  ]);
  const post = toFeedPost(snap.id, data, author, liked.exists());
  return post ? { ...post, tagged } : null;
}
