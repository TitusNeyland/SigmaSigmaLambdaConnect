import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten, type FirestoreEvent } from 'firebase-functions/v2/firestore';

/**
 * Sets a counter on a document to the real number of docs in one of its subcollections.
 * Recounting (instead of adding or subtracting one) keeps it right even if events arrive
 * twice, out of order, or alongside account deletion's own cleanup. Does nothing if the
 * parent is gone.
 */
export async function recount(
  parentPath: string,
  subcollection: string,
  field: string,
  db: Firestore = getFirestore(),
): Promise<number> {
  const parent = db.doc(parentPath);
  const total = (await parent.collection(subcollection).count().get()).data().count;
  try {
    await parent.update({ [field]: total });
  } catch (error) {
    // NOT_FOUND: the parent was deleted along with its children.
    if ((error as { code?: number }).code !== 5) throw error;
  }
  return total;
}

export const recountLikes = (postId: string, db?: Firestore) =>
  recount(`posts/${postId}`, 'likes', 'likeCount', db);

export const recountComments = (postId: string, db?: Firestore) =>
  recount(`posts/${postId}`, 'comments', 'commentCount', db);

export const recountCommentLikes = (postId: string, commentId: string, db?: Firestore) =>
  recount(`posts/${postId}/comments/${commentId}`, 'likes', 'likeCount', db);

/** True when a doc was added or removed; edits don't change a count. */
function addedOrRemoved(event: FirestoreEvent<unknown>): boolean {
  const change = event.data as { before?: { exists: boolean }; after?: { exists: boolean } };
  return !!change && change.before?.exists !== change.after?.exists;
}

export const countLikes = onDocumentWritten('posts/{postId}/likes/{uid}', async (event) => {
  if (!addedOrRemoved(event)) return;
  const total = await recountLikes(event.params.postId);
  logger.debug('Likes recounted', { postId: event.params.postId, total });
});

export const countComments = onDocumentWritten(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    if (!addedOrRemoved(event)) return;
    await recountComments(event.params.postId);
  },
);

export const countCommentLikes = onDocumentWritten(
  'posts/{postId}/comments/{commentId}/likes/{uid}',
  async (event) => {
    if (!addedOrRemoved(event)) return;
    await recountCommentLikes(event.params.postId, event.params.commentId);
  },
);
