import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from './firebase';

/** What the compose screen shares (#32). */
export type NewPost = {
  caption: string;
  /** Storage paths of uploaded photos, cover first. */
  photoPaths: string[];
  eventId: string | null;
  taggedMemberIds: string[];
  allowComments: boolean;
};

/** A new post's ID, made up front so its photos can be uploaded under it first. */
export function newPostId(): string {
  return doc(collection(db, 'posts')).id;
}

/** Where a post's photo lives in Storage. The storage rules only let the author write here. */
export const postPhotoPath = (uid: string, postId: string, index: number) =>
  `posts/${uid}/${postId}/${index}.jpg`;

/** Uploads one prepared JPEG for a post and returns its Storage path. */
export async function uploadPostPhoto(
  uid: string,
  postId: string,
  index: number,
  localUri: string,
): Promise<string> {
  const path = postPhotoPath(uid, postId, index);
  const blob = await (await fetch(localUri)).blob();
  await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });
  return path;
}

/**
 * Shares the post with the chapter. Only approved members who accepted the guidelines can,
 * and only approved members can see it; the rules enforce both.
 */
export async function createPost(id: string, uid: string, post: NewPost): Promise<void> {
  await setDoc(doc(db, 'posts', id), {
    authorId: uid,
    caption: post.caption,
    photoPaths: post.photoPaths,
    eventId: post.eventId,
    taggedMemberIds: post.taggedMemberIds,
    allowComments: post.allowComments,
    official: false,
    removed: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
}

/** For showing a photo right after upload, before the feed reloads. */
export const postPhotoUrl = (path: string) => getDownloadURL(ref(storage, path));
