import { getDoc, getDocs, limit, orderBy, startAfter, Timestamp, where } from 'firebase/firestore';

import { fetchFeedPage, postAspect, toFeedPost } from './feed';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    mockMs: number;
    constructor(mockMs: number) {
      this.mockMs = mockMs;
    }
    static fromMillis(ms: number) {
      return new MockTimestamp(ms);
    }
    toDate() {
      return new Date(this.mockMs);
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((_db: unknown, ...s: string[]) => ({ collection: s.join('/') })),
    doc: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
    where: jest.fn((...a: unknown[]) => ({ where: a })),
    orderBy: jest.fn((...a: unknown[]) => ({ orderBy: a })),
    limit: jest.fn((n: number) => ({ limit: n })),
    startAfter: jest.fn((c: unknown) => ({ startAfter: c })),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ref, parts })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
  };
});

const at = (ms: number) => Timestamp.fromMillis(ms);
type Docs = Record<string, Record<string, unknown> | null>;

type Rows = [string, Record<string, unknown>][];
const toSnaps = (rows: Rows) => rows.map(([id, data]) => ({ id, data: () => data }));

/** Posts for the feed query; comments (newest first) by post id for preview queries. */
function respond(posts: Rows, docs: Docs, comments: Record<string, Rows> = {}) {
  const snaps = toSnaps(posts);
  jest.mocked(getDocs).mockImplementation(async (q: unknown) => {
    const path = (q as { ref: { collection: string } }).ref.collection;
    if (path === 'posts') return { docs: snaps } as never;
    const postId = path.split('/')[1];
    return { docs: toSnaps(comments[postId] ?? []) } as never;
  });
  jest.mocked(getDoc).mockImplementation(async (ref: unknown) => {
    const data = docs[(ref as { path: string }).path] ?? null;
    return { exists: () => data !== null, data: () => data ?? {} } as never;
  });
  return snaps;
}

beforeEach(() => jest.clearAllMocks());

describe('toFeedPost', () => {
  it('maps a post with safe defaults', () => {
    expect(
      toFeedPost(
        'p',
        { authorId: 'a', createdAt: at(1000), photoPaths: ['x', 3, ''], likeCount: -2 },
        null,
        false,
      ),
    ).toEqual({
      id: 'p',
      authorId: 'a',
      author: null,
      caption: '',
      photoPaths: ['x'],
      eventId: null,
      allowComments: true,
      official: false,
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date(1000),
      likedByMe: false,
      previewComments: [],
      aspectRatio: 1,
      tagged: [],
    });
    expect(toFeedPost('p', { authorId: 'a' }, null, false)).toBeNull();
  });
});

describe('postAspect', () => {
  it('keeps a post’s shape in the allowed range, and older posts square', () => {
    expect(postAspect(16 / 9)).toBeCloseTo(16 / 9);
    expect(postAspect(0.5)).toBe(0.8);
    expect(postAspect(3)).toBe(1.91);
    expect(postAspect(undefined)).toBe(1);
    expect(postAspect('wide')).toBe(1);
  });
});

describe('fetchFeedPage', () => {
  it('asks for posts that aren’t removed, newest first, one page at a time', async () => {
    respond([], {});
    await fetchFeedPage('me', null, 10);
    expect(where).toHaveBeenCalledWith('removed', '==', false);
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(10);
    expect(startAfter).not.toHaveBeenCalled();
  });

  it('joins each author once, with their role, and whether I liked it', async () => {
    respond(
      [
        ['p1', { authorId: 'a', caption: 'One', createdAt: at(2000) }],
        ['p2', { authorId: 'a', caption: 'Two', createdAt: at(1000), official: true }],
        ['p3', { authorId: 'gone', caption: 'Three', createdAt: at(500) }],
      ],
      {
        'members/a': { displayName: 'Marcus Reed', initiationTerm: 'Spring 2019' },
        'roles/a': { role: 'officer', title: 'Treasurer' },
        'posts/p2/likes/me': { memberId: 'me' },
      },
    );
    const page = await fetchFeedPage('me', null, 10);
    expect(page.posts.map((p) => [p.id, p.author?.displayName ?? null, p.likedByMe])).toEqual([
      ['p1', 'Marcus Reed', false],
      ['p2', 'Marcus Reed', true],
      ['p3', null, false],
    ]);
    expect(page.posts[0].author?.role).toEqual({ role: 'officer', title: 'Treasurer' });
    const memberReads = jest
      .mocked(getDoc)
      .mock.calls.filter(([ref]) => (ref as unknown as { path: string }).path === 'members/a');
    expect(memberReads).toHaveLength(1);
  });

  it('previews the newest two top-level comments, oldest first, with names', async () => {
    respond(
      [
        ['p1', { authorId: 'a', createdAt: at(2000) }],
        ['p2', { authorId: 'a', createdAt: at(1000), allowComments: false }],
      ],
      {
        'members/a': { displayName: 'Marcus Reed' },
        'members/b': { displayName: 'Chris Baptiste' },
      },
      {
        p1: [
          ['c4', { authorId: 'b', text: 'A reply', replyToId: 'c1' }],
          ['c3', { authorId: 'a', text: ' Newest ' }],
          ['c2', { authorId: 'gone', text: 'Middle' }],
          ['c1', { authorId: 'b', text: 'Oldest' }],
        ],
        p2: [['c9', { authorId: 'b', text: 'Hidden, comments are off' }]],
      },
    );
    const page = await fetchFeedPage('me', null, 10);
    expect(page.posts[0].previewComments).toEqual([
      { id: 'c2', authorId: 'gone', authorName: 'Former member', text: 'Middle' },
      { id: 'c3', authorId: 'a', authorName: 'Marcus Reed', text: 'Newest' },
    ]);
    expect(page.posts[1].previewComments).toEqual([]);
    // Marcus wrote a post and a comment, and is still looked up once.
    const memberReads = jest
      .mocked(getDoc)
      .mock.calls.filter(([ref]) => (ref as unknown as { path: string }).path === 'members/a');
    expect(memberReads).toHaveLength(1);
  });

  it('still shows the post when its comment preview fails to load', async () => {
    respond([['p1', { authorId: 'a', createdAt: at(2000) }]], {
      'members/a': { displayName: 'Marcus Reed' },
    });
    const posts = jest.mocked(getDocs).getMockImplementation()!;
    jest.mocked(getDocs).mockImplementation(async (q: unknown) => {
      if ((q as { ref: { collection: string } }).ref.collection !== 'posts') throw new Error('x');
      return posts(q as never);
    });
    const page = await fetchFeedPage('me', null, 10);
    expect(page.posts.map((p) => [p.id, p.previewComments])).toEqual([['p1', []]]);
  });

  it('names the brothers tagged in each post, leaving out deleted profiles', async () => {
    respond(
      [['p1', { authorId: 'a', createdAt: at(2), taggedMemberIds: ['z', 'gone', 'a', 'z', 7] }]],
      {
        'members/a': { displayName: 'Marcus Reed' },
        'members/z': { displayName: 'Sample Zed' },
      },
    );
    const page = await fetchFeedPage('me', null, 10);
    expect(page.posts[0].tagged).toEqual([
      { uid: 'z', displayName: 'Sample Zed' },
      { uid: 'a', displayName: 'Marcus Reed' },
    ]);
  });

  it('hands back a cursor only when the page was full', async () => {
    const full = respond(
      [
        ['p1', { authorId: 'a', createdAt: at(2) }],
        ['p2', { authorId: 'a', createdAt: at(1) }],
      ],
      {},
    );
    expect((await fetchFeedPage('me', null, 2)).cursor).toBe(full[1]);
    respond([['p1', { authorId: 'a', createdAt: at(2) }]], {});
    expect((await fetchFeedPage('me', null, 2)).cursor).toBeNull();
  });

  it('continues after the cursor', async () => {
    respond([], {});
    const cursor = { id: 'p2' } as never;
    await fetchFeedPage('me', cursor);
    expect(startAfter).toHaveBeenCalledWith(cursor);
  });
});
