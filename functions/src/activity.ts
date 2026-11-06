import { FieldValue, getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';

import { preview } from './social.js';

/**
 * Activity: what happened that's about a member, newest first, shown behind the heart on
 * Home: likes, comments and replies on their posts, being tagged, new announcements, event
 * reminders and being approved. Written here with admin access; only the member can read
 * theirs.
 *
 *   activity/{uid}              { seenAt }  when they last opened Activity (they write it)
 *   activity/{uid}/items/{id}   one item
 *
 * Item IDs are fixed (like_{post}_{liker}, comment_{id}, reply_{id}, tag_{post},
 * announcement_{id}, reminder_{event}, approved) so a repeat event overwrites rather than
 * duplicates. Blocked people are filtered out in the app, so unblocking someone brings
 * their activity back.
 */
export type ActivityType =
  'like' | 'comment' | 'reply' | 'tag' | 'announcement' | 'event_reminder' | 'approved';

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

// ---------- Notices: tags, announcements, reminders, approval ----------

const BATCH = 400;

/** Writes the same item to several members' Activity, in batches. */
export async function recordForMembers(
  uids: string[],
  itemId: string,
  item: Record<string, unknown>,
  db: Firestore = getFirestore(),
): Promise<number> {
  const unique = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = db.batch();
    for (const uid of unique.slice(i, i + BATCH)) {
      batch.set(db.doc(`${itemsPath(uid)}/${itemId}`), item);
    }
    await batch.commit();
  }
  return unique.length;
}

const NO_ACTOR = { actorId: '', actorName: '', actorPhotoURL: null };

/** Tells each brother tagged in a new post. Tagging yourself adds nothing. */
export async function recordTags(
  postId: string,
  post: {
    authorId?: unknown;
    caption?: unknown;
    photoPaths?: unknown;
    taggedMemberIds?: unknown;
    createdAt?: unknown;
  },
  db: Firestore = getFirestore(),
): Promise<number> {
  const authorId = text(post.authorId);
  const tagged = Array.isArray(post.taggedMemberIds)
    ? post.taggedMemberIds.map(text).filter((uid) => uid && uid !== authorId)
    : [];
  if (!authorId || tagged.length === 0) return 0;
  const paths = Array.isArray(post.photoPaths) ? post.photoPaths : [];
  return recordForMembers(
    tagged,
    `tag_${postId}`,
    {
      type: 'tag' satisfies ActivityType,
      ...(await actor(db, authorId)),
      postId,
      text: preview(text(post.caption), ACTIVITY_TEXT_MAX),
      photoPath: text(paths[0]) || null,
      at: when(post.createdAt),
    },
    db,
  );
}

/** Puts a new announcement in every approved member's Activity, except the poster's own. */
export async function recordAnnouncement(
  id: string,
  data: { title?: unknown; authorId?: unknown; createdAt?: unknown },
  db: Firestore = getFirestore(),
): Promise<number> {
  const title = text(data.title);
  if (!title) return 0;
  const authorId = text(data.authorId);
  const members = await db.collection('members').where('status', '==', 'approved').get();
  return recordForMembers(
    members.docs.map((d) => d.id).filter((uid) => uid !== authorId),
    `announcement_${id}`,
    {
      type: 'announcement' satisfies ActivityType,
      ...(authorId ? await actor(db, authorId) : NO_ACTOR),
      announcementId: id,
      title: preview(title, ACTIVITY_TEXT_MAX),
      at: when(data.createdAt),
    },
    db,
  );
}

/** A reminder in Activity for everyone Going or Maybe to an event starting soon. */
export async function recordEventReminder(
  eventId: string,
  event: { title?: unknown; startsAt?: unknown },
  uids: string[],
  db: Firestore = getFirestore(),
): Promise<number> {
  const title = text(event.title);
  if (!title || !(event.startsAt instanceof Timestamp)) return 0;
  return recordForMembers(
    uids,
    `reminder_${eventId}`,
    {
      type: 'event_reminder' satisfies ActivityType,
      ...NO_ACTOR,
      eventId,
      title: preview(title, ACTIVITY_TEXT_MAX),
      startsAt: event.startsAt,
      at: FieldValue.serverTimestamp(),
    },
    db,
  );
}

/** Welcomes a member in their Activity once an officer approves them. */
export async function recordApproval(
  uid: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  db: Firestore = getFirestore(),
): Promise<boolean> {
  if (before?.status !== 'pending' || after?.status !== 'approved') return false;
  await db.doc(`${itemsPath(uid)}/approved`).set({
    type: 'approved' satisfies ActivityType,
    ...NO_ACTOR,
    at: FieldValue.serverTimestamp(),
  });
  return true;
}

export const recordTagActivity = onDocumentCreated('posts/{postId}', async (event) => {
  const data = event.data?.data();
  if (data) await recordTags(event.params.postId, data);
});

export const recordAnnouncementActivity = onDocumentCreated('announcements/{id}', async (event) => {
  const data = event.data?.data();
  if (data) await recordAnnouncement(event.params.id, data);
});

export const recordApprovalActivity = onDocumentUpdated('members/{uid}', async (event) => {
  await recordApproval(event.params.uid, event.data?.before.data(), event.data?.after.data());
});
