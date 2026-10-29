import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firebase';

/**
 * Likes a post. The like count on the post is kept by a Cloud Function, which recounts
 * after every like and unlike, so it stays accurate.
 */
export async function likePost(postId: string, uid: string): Promise<void> {
  await setDoc(doc(db, 'posts', postId, 'likes', uid), {
    memberId: uid,
    createdAt: serverTimestamp(),
  });
}

export async function unlikePost(postId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId, 'likes', uid));
}
