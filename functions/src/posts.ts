import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

/**
 * Sets a post's likeCount to the real number of likes. Recounting (instead of adding or
 * subtracting one) keeps it right even if events arrive twice, out of order, or alongside
 * account deletion's own cleanup. Does nothing if the post is gone.
 */
export async function recountLikes(postId: string, db: Firestore = getFirestore()) {
  const post = db.doc(`posts/${postId}`);
  const total = (await post.collection('likes').count().get()).data().count;
  try {
    await post.update({ likeCount: total });
  } catch (error) {
    // NOT_FOUND: the post was deleted along with its likes.
    if ((error as { code?: number }).code !== 5) throw error;
  }
  return total;
}

export const countLikes = onDocumentWritten('posts/{postId}/likes/{uid}', async (event) => {
  const created = !event.data?.before.exists && event.data?.after.exists;
  const deleted = event.data?.before.exists && !event.data?.after.exists;
  if (!created && !deleted) return;
  const total = await recountLikes(event.params.postId);
  logger.debug('Likes recounted', { postId: event.params.postId, total });
});
