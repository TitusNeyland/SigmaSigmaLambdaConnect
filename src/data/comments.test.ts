import {
  addDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

import { addComment, likeComment, subscribeToComments, toComment, unlikeComment } from './comments';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('./feed', () => ({
  fetchAuthor: jest.fn(async (uid: string) => (uid === 'gone' ? null : { uid, displayName: uid })),
}));
const { fetchAuthor } = jest.requireMock<typeof import('./feed')>('./feed');
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    mockMs: number;
    constructor(ms: number) {
      this.mockMs = ms;
    }
    toDate() {
      return new Date(this.mockMs);
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
    doc: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ref, parts })),
    orderBy: jest.fn((...a: unknown[]) => ({ orderBy: a })),
    limit: jest.fn((n: number) => ({ limit: n })),
    onSnapshot: jest.fn(),
    getDoc: jest.fn(),
    addDoc: jest.fn(),
    setDoc: jest.fn(),
    deleteDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);

beforeEach(() => jest.clearAllMocks());

describe('toComment', () => {
  it('maps a comment, and shows my unsent time as now', () => {
    expect(
      toComment(
        'c',
        { authorId: 'a', text: ' Hi ', createdAt: ts(5), replyToId: 'p', likeCount: 2 },
        null,
        true,
      ),
    ).toEqual({
      id: 'c',
      authorId: 'a',
      author: null,
      text: 'Hi',
      createdAt: new Date(5),
      replyToId: 'p',
      likeCount: 2,
      likedByMe: true,
    });
    expect(
      toComment('c', { authorId: 'a', text: 'x', createdAt: null }, null, false)?.createdAt,
    ).toBeInstanceOf(Date);
    expect(toComment('c', { authorId: 'a', text: '  ' }, null, false)).toBeNull();
  });
});

describe('subscribeToComments', () => {
  it('lists comments oldest first with authors looked up once, and my likes', async () => {
    jest.mocked(getDoc).mockImplementation(async (ref: unknown) => {
      const path = (ref as { path: string }).path;
      return { exists: () => path === 'posts/p/comments/c2/likes/me' } as never;
    });
    const onChange = jest.fn();
    subscribeToComments('p', 'me', onChange, jest.fn());
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'asc');
    const next = jest.mocked(onSnapshot).mock.calls[0][1] as unknown as (s: object) => void;
    next({
      docs: [
        { id: 'c1', data: () => ({ authorId: 'a', text: 'One', createdAt: ts(1) }) },
        { id: 'c2', data: () => ({ authorId: 'a', text: 'Two', createdAt: ts(2) }) },
        { id: 'c3', data: () => ({ authorId: 'gone', text: 'Three', createdAt: ts(3) }) },
      ],
    });
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
    const list = onChange.mock.calls.at(-1)![0];
    expect(
      list.map((x: { id: string; likedByMe: boolean; author: unknown }) => [
        x.id,
        x.likedByMe,
        !!x.author,
      ]),
    ).toEqual([
      ['c1', false, true],
      ['c2', true, true],
      ['c3', false, false],
    ]);
    expect(fetchAuthor).toHaveBeenCalledTimes(2);
  });
});

describe('writes', () => {
  it('adds a comment, or a reply, with exactly the fields the rules allow', async () => {
    await addComment('p', 'me', '  Great night ');
    expect(addDoc).toHaveBeenLastCalledWith(
      { path: 'posts/p/comments' },
      { authorId: 'me', text: 'Great night', createdAt: 'NOW' },
    );
    await addComment('p', 'me', 'Agreed', 'c1');
    expect(addDoc).toHaveBeenLastCalledWith(
      { path: 'posts/p/comments' },
      { authorId: 'me', text: 'Agreed', createdAt: 'NOW', replyToId: 'c1' },
    );
  });

  it('likes and unlikes a comment', async () => {
    await likeComment('p', 'c1', 'me');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'posts/p/comments/c1/likes/me' },
      { memberId: 'me', createdAt: 'NOW' },
    );
    await unlikeComment('p', 'c1', 'me');
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'posts/p/comments/c1/likes/me' });
  });
});
