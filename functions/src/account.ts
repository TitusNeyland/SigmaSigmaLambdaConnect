import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

/** How recently the member must have entered their password before deleting (seconds). */
export const RECENT_LOGIN_SECONDS = 5 * 60;

/** True if the sign-in that produced this token happened within the window. */
export function isRecentLogin(authTimeSeconds: number | undefined, nowMs: number): boolean {
  if (typeof authTimeSeconds !== 'number') return false;
  return nowMs / 1000 - authTimeSeconds <= RECENT_LOGIN_SECONDS;
}

/** Minimal Storage surface used here, so tests can pass the emulator bucket. */
export type BucketLike = { deleteFiles(options: { prefix: string }): Promise<unknown> };

export type DeletionSummary = {
  posts: number;
  comments: number;
  likes: number;
  rsvps: number;
};

const BATCH = 400;

/**
 * Removes everything that identifies a member. Kept on purpose: attendance records
 * (memberId only, no name, so chapter metrics stay accurate) and reports officers have
 * already reviewed.
 */
export async function deleteUserData(
  uid: string,
  deps: { db: Firestore; bucket: BucketLike; auth: Auth },
): Promise<DeletionSummary> {
  const { db, bucket, auth } = deps;

  // Their posts, with every comment and like on them.
  const posts = await db.collection('posts').where('authorId', '==', uid).get();
  for (const post of posts.docs) await db.recursiveDelete(post.ref);
  const deletedPosts = new Set(posts.docs.map((p) => p.ref.path));

  // Their comments and likes on other people's posts, keeping those posts' counts right.
  const comments = await db.collectionGroup('comments').where('authorId', '==', uid).get();
  const likes = await db.collectionGroup('likes').where('memberId', '==', uid).get();
  const rsvps = await db.collectionGroup('rsvps').where('memberId', '==', uid).get();

  const writes: ((batch: FirebaseFirestore.WriteBatch) => void)[] = [];
  for (const doc of comments.docs) {
    const post = doc.ref.parent.parent;
    writes.push((b) => b.delete(doc.ref));
    if (post && !deletedPosts.has(post.path)) {
      writes.push((b) => b.update(post, { commentCount: FieldValue.increment(-1) }));
    }
  }
  for (const doc of likes.docs) {
    const post = doc.ref.parent.parent;
    writes.push((b) => b.delete(doc.ref));
    if (post && !deletedPosts.has(post.path)) {
      writes.push((b) => b.update(post, { likeCount: FieldValue.increment(-1) }));
    }
  }
  for (const doc of rsvps.docs) writes.push((b) => b.delete(doc.ref));
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = db.batch();
    for (const write of writes.slice(i, i + BATCH)) write(batch);
    await batch.commit();
  }

  // Their block list, push tokens, role and profile (with its private contact doc).
  await db.recursiveDelete(db.doc(`blocks/${uid}`));
  await db.recursiveDelete(db.doc(`pushTokens/${uid}`));
  await db.doc(`roles/${uid}`).delete();
  await db.recursiveDelete(db.doc(`members/${uid}`));

  // Their photos.
  await bucket.deleteFiles({ prefix: `avatars/${uid}/` });
  await bucket.deleteFiles({ prefix: `posts/${uid}/` });

  // Finally the sign-in itself. Already gone is fine.
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }

  return {
    posts: posts.size,
    comments: comments.size,
    likes: likes.size,
    rsvps: rsvps.size,
  };
}

/**
 * Deletes the caller's own account (#16). The app asks for their password first, and the
 * server checks that sign-in was recent so a borrowed, unlocked phone can't do this.
 */
export const deleteAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!isRecentLogin(request.auth.token.auth_time, Date.now())) {
    throw new HttpsError('failed-precondition', 'recent-login-required');
  }
  const summary = await deleteUserData(request.auth.uid, {
    db: getFirestore(),
    bucket: getStorage().bucket(),
    auth: getAuth(),
  });
  return { deleted: true, ...summary };
});
