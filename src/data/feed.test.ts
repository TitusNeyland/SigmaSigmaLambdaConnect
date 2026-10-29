import { getDoc, getDocs, limit, orderBy, startAfter, Timestamp, where } from 'firebase/firestore';

import { fetchFeedPage, toFeedPost } from './feed';

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
    collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
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

function respond(posts: [string, Record<string, unknown>][], docs: Docs) {
  const snaps = posts.map(([id, data]) => ({ id, data: () => data }));
  jest.mocked(getDocs).mockResolvedValue({ docs: snaps } as never);
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
    });
    expect(toFeedPost('p', { authorId: 'a' }, null, false)).toBeNull();
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
