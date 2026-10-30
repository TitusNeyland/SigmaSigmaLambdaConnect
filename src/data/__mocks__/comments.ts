/**
 * Test double for src/data/comments.ts. Use with `jest.mock('@/data/comments')`, then set
 * comments with `setMockComments`. Adding a comment updates live subscribers.
 */
import type { PostComment } from '../comments';

let comments: Record<string, PostComment[]> = {};
let failing = false;
const listeners = new Map<string, Set<(c: PostComment[]) => void>>();

export function sampleComment(overrides: Partial<PostComment> = {}): PostComment {
  return {
    id: 'c1',
    authorId: 'sample-chris',
    author: {
      uid: 'sample-chris',
      displayName: 'Chris Baptiste',
      photoURL: null,
      headline: 'Nurse',
      initiationTerm: 'Fall 2021',
      role: null,
    },
    text: 'Sample comment.',
    createdAt: new Date(Date.now() - 3600_000),
    replyToId: null,
    likeCount: 0,
    likedByMe: false,
    ...overrides,
  };
}

export function setMockComments(postId: string, next: PostComment[]) {
  comments[postId] = next;
  for (const l of listeners.get(postId) ?? []) l(next);
}

export function failCommentsLoad() {
  failing = true;
}

export const subscribeToComments = jest.fn(
  (
    postId: string,
    _uid: string,
    onChange: (c: PostComment[]) => void,
    onError: (e: unknown) => void,
  ) => {
    if (failing) {
      failing = false;
      onError(new Error('offline'));
      return () => {};
    }
    if (!listeners.has(postId)) listeners.set(postId, new Set());
    listeners.get(postId)!.add(onChange);
    onChange(comments[postId] ?? []);
    return () => {
      listeners.get(postId)?.delete(onChange);
    };
  },
);

let counter = 0;
export const addComment = jest.fn(
  async (postId: string, uid: string, text: string, replyToId: string | null = null) => {
    const mine = sampleComment({
      id: `new-${++counter}`,
      authorId: uid,
      author: null,
      text: text.trim(),
      createdAt: new Date(),
      replyToId,
    });
    setMockComments(postId, [...(comments[postId] ?? []), mine]);
  },
);
export const likeComment = jest.fn(async (_p: string, _c: string, _u: string) => {});
export const unlikeComment = jest.fn(async (_p: string, _c: string, _u: string) => {});

export function resetCommentsMock() {
  comments = {};
  failing = false;
  counter = 0;
  listeners.clear();
  subscribeToComments.mockClear();
  addComment.mockClear();
  likeComment.mockReset().mockResolvedValue(undefined);
  unlikeComment.mockReset().mockResolvedValue(undefined);
}
