import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

import { fetchAuthor, type FeedAuthor } from './feed';
import { db, storage } from './firebase';
import { localJpeg } from './localJpeg';

export type PostComment = {
  id: string;
  authorId: string;
  author: FeedAuthor | null;
  text: string;
  /** Storage path of a photo on the comment. Null for text-only. */
  photoPath: string | null;
  createdAt: Date;
  replyToId: string | null;
  likeCount: number;
  likedByMe: boolean;
};

/** Plenty for a chapter post; older ones past this aren't shown. */
export const MAX_COMMENTS = 300;

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function toComment(
  id: string,
  data: Record<string, unknown>,
  author: FeedAuthor | null,
  likedByMe: boolean,
): PostComment | null {
  const authorId = text(data.authorId);
  const body = text(data.text).trim();
  const photoPath = typeof data.photoPath === 'string' && data.photoPath ? data.photoPath : null;
  if (!authorId || (!body && !photoPath)) return null;
  return {
    id,
    authorId,
    author,
    text: body,
    photoPath,
    // Our own new comment shows before the server stamps its time.
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    replyToId: typeof data.replyToId === 'string' && data.replyToId ? data.replyToId : null,
    likeCount: typeof data.likeCount === 'number' && data.likeCount > 0 ? data.likeCount : 0,
    likedByMe,
  };
}

/**
 * Live comments on a post, oldest first, with authors and whether the member liked each.
 * Authors are cached for the life of the subscription.
 */
export function subscribeToComments(
  postId: string,
  uid: string,
  onChange: (comments: PostComment[]) => void,
  onError: (error: unknown) => void,
): () => void {
  const authors = new Map<string, Promise<FeedAuthor | null>>();
  const author = (id: string) => {
    if (!authors.has(id))
      authors.set(
        id,
        fetchAuthor(id).catch(() => null),
      );
    return authors.get(id)!;
  };
  let latest = 0;
  return onSnapshot(
    query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(MAX_COMMENTS),
    ),
    (snap) => {
      const run = ++latest;
      Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const [who, liked] = await Promise.all([
            author(text(data.authorId)),
            getDoc(doc(db, 'posts', postId, 'comments', d.id, 'likes', uid)),
          ]);
          return toComment(d.id, data, who, liked.exists());
        }),
      ).then(
        (list) => run === latest && onChange(list.filter((c): c is PostComment => c !== null)),
        onError,
      );
    },
    onError,
  );
}

/** Where a comment photo lives. The storage rules only let that member write this file. */
export const commentPhotoStoragePath = (postId: string, uid: string, commentId: string) =>
  `comments/${postId}/${uid}-${commentId}.jpg`;

/** Uploads a prepared JPEG for a comment and returns its Storage path. */
export async function uploadCommentPhoto(
  postId: string,
  uid: string,
  commentId: string,
  localUri: string,
): Promise<string> {
  const path = commentPhotoStoragePath(postId, uid, commentId);
  await uploadBytes(ref(storage, path), await localJpeg(localUri), {
    contentType: 'image/jpeg',
  });
  return path;
}

/**
 * Adds a comment, or a reply to one. A photo is optional; text can be empty when there is
 * one. The post's comment count is kept by a Cloud Function.
 */
export async function addComment(
  postId: string,
  uid: string,
  body: string,
  replyToId: string | null = null,
  photoUri?: string,
): Promise<void> {
  const commentRef = doc(collection(db, 'posts', postId, 'comments'));
  const photoPath = photoUri
    ? await uploadCommentPhoto(postId, uid, commentRef.id, photoUri)
    : null;
  await setDoc(commentRef, {
    authorId: uid,
    text: body.trim(),
    createdAt: serverTimestamp(),
    ...(replyToId ? { replyToId } : {}),
    ...(photoPath ? { photoPath } : {}),
  });
}

export async function likeComment(postId: string, commentId: string, uid: string) {
  await setDoc(doc(db, 'posts', postId, 'comments', commentId, 'likes', uid), {
    memberId: uid,
    createdAt: serverTimestamp(),
  });
}

export async function unlikeComment(postId: string, commentId: string, uid: string) {
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId, 'likes', uid));
}

/** Deletes one of the member's own comments. Replies to it stay, shown on their own. */
export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
}
