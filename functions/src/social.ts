import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { sendPush, type PushDeps, type PushMessage } from './push.js';

/** Likes are sent as a digest this often, so a popular post doesn't buzz a phone 30 times. */
export const LIKE_DIGEST_MINUTES = 15;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** "Great night, see everyone…" for a notification body. */
export function preview(body: string, max = 80): string {
  const t = body.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function commentMessage(
  postId: string,
  who: string,
  body: string,
  kind: 'comment' | 'reply',
): PushMessage {
  return {
    title: kind === 'reply' ? `${who} replied to your comment` : `${who} commented on your post`,
    body: preview(body),
    data: { postId },
  };
}

/**
 * One notification for everything liked since the last digest. names are the likers,
 * newest first; posts is how many of the author's posts they liked.
 */
export function likeDigestMessage(names: string[], posts: string[]): PushMessage | null {
  if (names.length === 0 || posts.length === 0) return null;
  const others = names.length - 1;
  const who =
    others === 0 ? names[0] : `${names[0]} and ${others} ${others === 1 ? 'other' : 'others'}`;
  return {
    title: posts.length === 1 ? `${who} liked your post` : `${who} liked your posts`,
    body: posts.length === 1 ? 'Tap to see it.' : `${posts.length} of your posts got likes.`,
    data: posts.length === 1 ? { postId: posts[0] } : { screen: 'profile' },
  };
}

async function displayName(db: Firestore, uid: string): Promise<string> {
  const snap = await db.doc(`members/${uid}`).get();
  return text(snap.get('displayName')) || 'A brother';
}

/** Whether `uid` blocked `other`. Blocked people never trigger notifications. */
async function hasBlocked(db: Firestore, uid: string, other: string): Promise<boolean> {
  return (await db.doc(`blocks/${uid}/blocked/${other}`).get()).exists;
}

/**
 * Tells the post's author about a new comment, and the parent comment's author about a
 * reply. Never notifies you about your own comment, or about someone you blocked.
 */
export async function notifyComment(
  postId: string,
  comment: { authorId?: unknown; text?: unknown; replyToId?: unknown },
  deps: PushDeps = {},
) {
  const db = deps.db ?? getFirestore();
  const actor = text(comment.authorId);
  if (!actor) return { sent: 0 };
  const post = await db.doc(`posts/${postId}`).get();
  if (!post.exists || post.get('removed') === true) return { sent: 0 };
  const who = await displayName(db, actor);
  const body = text(comment.text);
  let sent = 0;

  const postAuthor = text(post.get('authorId'));
  const replyTo = text(comment.replyToId);
  const parentAuthor = replyTo
    ? text((await db.doc(`posts/${postId}/comments/${replyTo}`).get()).get('authorId'))
    : '';

  if (parentAuthor && parentAuthor !== actor && !(await hasBlocked(db, parentAuthor, actor))) {
    sent += (
      await sendPush([parentAuthor], 'social', commentMessage(postId, who, body, 'reply'), deps)
    ).sent;
  }
  // The post's author hears about every comment, unless they were just told about the reply.
  if (
    postAuthor &&
    postAuthor !== actor &&
    postAuthor !== parentAuthor &&
    !(await hasBlocked(db, postAuthor, actor))
  ) {
    sent += (
      await sendPush([postAuthor], 'social', commentMessage(postId, who, body, 'comment'), deps)
    ).sent;
  }
  return { sent };
}

/** Where a like waits for the next digest. Server only; no rule lets the app touch it. */
const pendingPath = (authorId: string, postId: string, likerId: string) =>
  `likeDigests/${authorId}/pending/${postId}_${likerId}`;

/** Queues a like for the author's next digest. Liking your own post queues nothing. */
export async function queueLike(postId: string, likerId: string, db: Firestore = getFirestore()) {
  const post = await db.doc(`posts/${postId}`).get();
  const authorId = text(post.get('authorId'));
  if (!post.exists || !authorId || authorId === likerId) return false;
  await db.doc(pendingPath(authorId, postId, likerId)).set({
    postId,
    likerId,
    at: FieldValue.serverTimestamp(),
  });
  return true;
}

/** An unlike before the digest goes out takes the like back out of it. */
export async function unqueueLike(postId: string, likerId: string, db: Firestore = getFirestore()) {
  const post = await db.doc(`posts/${postId}`).get();
  const authorId = text(post.get('authorId'));
  if (!authorId) return;
  await db.doc(pendingPath(authorId, postId, likerId)).delete();
}

/** Sends each author one notification for their queued likes, then clears the queue. */
export async function sendLikeDigests(deps: PushDeps = {}) {
  const db = deps.db ?? getFirestore();
  const pending = await db.collectionGroup('pending').get();
  const byAuthor = new Map<
    string,
    { ref: FirebaseFirestore.DocumentReference; postId: string; likerId: string; at: number }[]
  >();
  for (const doc of pending.docs) {
    const authorId = doc.ref.parent.parent?.id;
    if (!authorId || doc.ref.parent.parent?.parent.id !== 'likeDigests') continue;
    const item = {
      ref: doc.ref,
      postId: text(doc.get('postId')),
      likerId: text(doc.get('likerId')),
      at: doc.get('at')?.toMillis?.() ?? 0,
    };
    byAuthor.set(authorId, [...(byAuthor.get(authorId) ?? []), item]);
  }

  let digests = 0;
  for (const [authorId, items] of byAuthor) {
    const blocked = new Set(
      (await db.collection(`blocks/${authorId}/blocked`).get()).docs.map((d) => d.id),
    );
    const kept = items
      .filter((i) => i.likerId && i.postId && !blocked.has(i.likerId))
      .sort((a, b) => b.at - a.at);
    const likers = [...new Set(kept.map((i) => i.likerId))];
    const posts = [...new Set(kept.map((i) => i.postId))];
    const names = await Promise.all(likers.map((uid) => displayName(db, uid)));
    const message = likeDigestMessage(names, posts);
    // Clear first: a crash after this skips one digest rather than sending it twice.
    await Promise.all(items.map((i) => i.ref.delete()));
    if (message) {
      await sendPush([authorId], 'social', message, deps);
      digests++;
    }
  }
  return { digests };
}

export const notifyNewComment = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    const data = event.data?.data();
    // A comment put back by an officer's undo (#50) isn't new; don't notify again.
    if (data && !data.restoredAt) await notifyComment(event.params.postId, data);
  },
);

export const queueLikeNotification = onDocumentCreated('posts/{postId}/likes/{uid}', (event) =>
  queueLike(event.params.postId, event.params.uid).then(() => undefined),
);

export const unqueueLikeNotification = onDocumentDeleted('posts/{postId}/likes/{uid}', (event) =>
  unqueueLike(event.params.postId, event.params.uid),
);

export const likeDigests = onSchedule(`every ${LIKE_DIGEST_MINUTES} minutes`, async () => {
  const result = await sendLikeDigests();
  logger.info('Like digests', result);
});
