/** Test double for src/data/posts.ts. Use with `jest.mock('@/data/posts')`. */
import type { NewPost } from '../posts';

export const postPhotoPath = (uid: string, postId: string, index: number) =>
  `posts/${uid}/${postId}/${index}.jpg`;
export const newPostId = jest.fn(() => 'new-post');
export const uploadPostPhoto = jest.fn(
  async (uid: string, postId: string, index: number, _uri: string, _onProgress?: unknown) =>
    postPhotoPath(uid, postId, index),
);
export const createPost = jest.fn(async (_id: string, _uid: string, _post: NewPost) => {});
export const postPhotoUrl = jest.fn(async (path: string) => `https://example.test/${path}`);

export function resetPostsMock() {
  newPostId.mockClear();
  uploadPostPhoto
    .mockReset()
    .mockImplementation(async (uid: string, postId: string, index: number) =>
      postPhotoPath(uid, postId, index),
    );
  createPost.mockReset().mockResolvedValue(undefined);
}
