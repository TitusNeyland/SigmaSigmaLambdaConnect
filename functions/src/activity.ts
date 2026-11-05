import { FieldValue, getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';

import { preview } from './social.js';

/**
 * Activity: the likes, comments and replies on a member's posts, newest first, shown behind
 * the heart on Home. Written here with admin access; only the member can read theirs.
 *
 *   activity/{uid}              { seenAt }  when they last opened Activity (they write it)
 *   activity/{uid}/items/{id}   one like, comment or reply
 *
 * Item IDs are fixed (like_{post}_{liker}, comment_{id}, reply_{id}) so a repeat event
 * overwrites rather than duplicates. Blocked people are filtered out in the app, so
 * unblocking someone brings their activity back.
 */
export type ActivityType = 'like' | 'comment' | 'reply';

/** Most an item keeps of a comment. The app shows two lines. */
export const ACTIVITY_TEXT_MAX = 120;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const itemsPath = (uid: string) => `activity/${uid}/items`;
export const likeItemId = (postId: string, likerId: string) => `like_${postId}_${likerId}`;

type Post = { authorId: string; photoPath: string | null };

async function readPost(db: Firestore, postId: string): Promise<Post | null> {
  const snap = await db.doc(`posts/${postId}`).get();
  const authorId = text(snap.get('authorId'));
  if (!snap.exists || !authorId || snap.get('removed') === true) return null;
  const paths = snap.get('photoPaths');
  const first = Array.isArray(paths) ? text(paths[0]) : '';
  return { authorId, photoPath: first || null };
}

async function actor(db: Firestore, uid: string) {
  const snap = await db.doc(`members/${uid}`).get();
  const photo = snap.get('photoURL');
  return {
    actorId: uid,
    actorName: text(snap.get('displayName')) || 'A brother',
    actorPhotoURL: typeof photo === 'string' && photo ? photo : null,
  };
}

const when = (v: unknown) => (v instanceof Timestamp ? v : FieldValue.serverTimestamp());

/** Adds a like to the post author's Activity. Liking your own post adds nothing. */
export async function recordLike(
  postId: string,
  likerId: string,
  likedAt?: unknown,
  db: Firestore = getFirestore(),
): Promise<boolean> {
  const post = await readPost(db, postId);
  if (!post || post.authorId === likerId) return false;
  await db.doc(`${itemsPath(post.authorId)}/${likeItemId(postId, likerId)}`).set({
    type: 'like' satisfies ActivityType,
    ...(await actor(db, likerId)),
    postId,
    photoPath: post.photoPath,
    at: when(likedAt),
  });
  return true;
}

/** An unlike takes the like back out of the author's Activity. */
export async function removeLike(postId: string, likerId: string, db: Firestore = getFirestore()) {
  const authorId = text((await db.doc(`posts/${postId}`).get()).get('authorId'));
  // A deleted post's items are cleared by removePostActivity.
  if (authorId) await db.doc(`${itemsPath(authorId)}/${likeItemId(postId, likerId)}`).delete();
}

/**
 * Adds a comment to the post author's Activity, and a reply to the Activity of the person
 * replied to. Like the push, the post's author hears once: a reply to their own comment
 * shows as a reply. Your own comments add nothing.
 */
export async function recordComment(
  postId: string,
  commentId: string,
  comment: { authorId?: unknown; text?: unknown; replyToId?: unknown; createdAt?: unknown },
  db: Firestore = getFirestore(),
): Promise<number> {
  const actorId = text(comment.authorId);
  const post = actorId ? await readPost(db, postId) : null;
  if (!post) return 0;
  const replyTo = text(comment.replyToId);
  const parentAuthor = replyTo
    ? text((await db.doc(`posts/${postId}/comments/${replyTo}`).get()).get('authorId'))
    : '';
  const who = await actor(db, actorId);
  const base = {
    ...who,
    postId,
    commentId,
    text: preview(text(comment.text), ACTIVITY_TEXT_MAX),
    photoPath: post.photoPath,
    at: when(comment.createdAt),
  };

  const writes: Promise<unknown>[] = [];
  if (parentAuthor && parentAuthor !== actorId) {
    writes.push(
      db.doc(`${itemsPath(parentAuthor)}/reply_${commentId}`).set({ type: 'reply', ...base }),
    );
  }
  if (post.authorId !== actorId && post.authorId !== parentAuthor) {
    writes.push(
      db.doc(`${itemsPath(post.authorId)}/comment_${commentId}`).set({ type: 'comment', ...base }),
    );
  }
  await Promise.all(writes);
  return writes.length;
}

/** Deletes every Activity item where `field` is `value`, across all members. */
async function removeWhere(db: Firestore, field: 'postId' | 'commentId', value: string) {
  const snap = await db.collectionGroup('items').where(field, '==', value).get();
  // hidden/{uid}/items is also called items; only touch Activity.
  const mine = snap.docs.filter((d) => d.ref.parent.parent?.parent.id === 'activity');
  await Promise.all(mine.map((d) => d.ref.delete()));
  return mine.length;
}

/** A deleted comment leaves the Activity it was in. */
export const removeCommentItems = (commentId: string, db: Firestore = getFirestore()) =>
  removeWhere(db, 'commentId', commentId);

/** A deleted post takes its likes, comments and replies out of everyone's Activity. */
export const removePostItems = (postId: string, db: Firestore = getFirestore()) =>
  removeWhere(db, 'postId', postId);

export const recordLikeActivity = onDocumentCreated('posts/{postId}/likes/{uid}', (event) =>
  recordLike(event.params.postId, event.params.uid, event.data?.get('createdAt')).then(
    () => undefined,
  ),
);

export const removeLikeActivity = onDocumentDeleted('posts/{postId}/likes/{uid}', (event) =>
  removeLike(event.params.postId, event.params.uid),
);

export const recordCommentActivity = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    const data = event.data?.data();
    if (data) await recordComment(event.params.postId, event.params.commentId, data);
  },
);

export const removeCommentActivity = onDocumentDeleted(
  'posts/{postId}/comments/{commentId}',
  (event) => removeCommentItems(event.params.commentId).then(() => undefined),
);

export const removePostActivity = onDocumentDeleted('posts/{postId}', (event) =>
  removePostItems(event.params.postId).then(() => undefined),
);
