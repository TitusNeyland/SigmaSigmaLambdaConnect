/**
 * Test double for src/data/feed.ts. Use with `jest.mock('@/data/feed')`, then set posts
 * with `resetFeedMock`. Pages are cut from that list; the cursor is the next index.
 */
import type { FeedPage, FeedPost } from '../feed';

let posts: FeedPost[] = [];
let failing = false;
export const MOCK_PAGE_SIZE = 3;

export function samplePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 'sample-post',
    authorId: 'sample-marcus',
    author: {
      uid: 'sample-marcus',
      displayName: 'Marcus Reed',
      photoURL: null,
      headline: 'Software engineer',
      initiationTerm: 'Spring 2019',
      role: null,
    },
    caption: 'Sample post caption.',
    photoPaths: [],
    eventId: null,
    allowComments: true,
    official: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date(Date.now() - 2 * 3600_000),
    likedByMe: false,
    ...overrides,
  };
}

export function setMockPosts(next: FeedPost[]) {
  posts = next;
}

export function failFeedLoad() {
  failing = true;
}

export const fetchFeedPage = jest.fn(
  async (_uid: string, cursor: unknown = null): Promise<FeedPage> => {
    if (failing) {
      failing = false;
      throw new Error('offline');
    }
    const start = typeof cursor === 'number' ? cursor : 0;
    const end = start + MOCK_PAGE_SIZE;
    return {
      posts: posts.slice(start, end),
      cursor: (end < posts.length ? end : null) as never,
    };
  },
);

let details: Record<string, FeedPost | null> = {};

/** Posts the detail screen can open. Falls back to the feed list. */
export function setMockPostDetails(next: Record<string, FeedPost | null>) {
  details = next;
}

export const fetchPost = jest.fn(async (postId: string, _uid: string) => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  if (postId in details) return details[postId];
  return posts.find((p) => p.id === postId) ?? null;
});

export const fetchAuthor = jest.fn(async () => null);

export function resetFeedMock(initial: FeedPost[] = []) {
  posts = initial;
  failing = false;
  fetchFeedPage.mockClear();
  details = {};
  fetchPost.mockClear();
}
