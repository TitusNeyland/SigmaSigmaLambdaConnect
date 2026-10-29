/** Test double for src/data/likes.ts. Use with `jest.mock('@/data/likes')`. */
export const likePost = jest.fn(async (_postId: string, _uid: string) => {});
export const unlikePost = jest.fn(async (_postId: string, _uid: string) => {});

export function resetLikesMock() {
  likePost.mockReset().mockResolvedValue(undefined);
  unlikePost.mockReset().mockResolvedValue(undefined);
}
