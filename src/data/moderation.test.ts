import { getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import {
  fetchMyRestriction,
  fetchReportQueue,
  groupReports,
  resolveReportCase,
  undoReportDecision,
} from './moderation';

jest.mock('./firebase', () => ({ db: { name: 'db' }, functions: { name: 'functions' } }));
const mockCall = jest.fn(async (_data?: unknown) => ({ data: { decisionId: 'd1' } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn(() => mockCall) }));
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
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ...ref, parts })),
    where: jest.fn((...a: unknown[]) => ({ where: a })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
  };
});

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);
const found = (data: Record<string, unknown>) => ({ exists: () => true, data: () => data });
const missing = { exists: () => false, data: () => undefined };
beforeEach(() => jest.clearAllMocks());

const raw = (id: string, extra: Partial<Parameters<typeof groupReports>[0][number]> = {}) => ({
  id,
  targetType: 'post' as const,
  postId: 'p1',
  commentId: null,
  authorId: 'author',
  reason: 'spam' as const,
  details: '',
  createdAt: new Date(1000),
  ...extra,
});

describe('groupReports', () => {
  it('groups by what was reported, counting reasons, most-reported first', () => {
    const cases = groupReports([
      raw('r1'),
      raw('r2', { reason: 'harassment', details: 'Sample detail', createdAt: new Date(5000) }),
      raw('r3', { reason: 'harassment' }),
      raw('m1', { targetType: 'member', postId: null, authorId: 'bob', createdAt: new Date(9000) }),
    ]);
    expect(cases.map((c) => [c.key, c.count])).toEqual([
      ['post_p1', 3],
      ['member_bob', 1],
    ]);
    expect(cases[0].reasons).toEqual([
      { reason: 'harassment', count: 2 },
      { reason: 'spam', count: 1 },
    ]);
    expect(cases[0]).toMatchObject({
      details: ['Sample detail'],
      latestAt: new Date(5000),
      reportIds: ['r1', 'r2', 'r3'],
    });
  });

  it('breaks ties by most recent', () => {
    const cases = groupReports([
      raw('a', { postId: 'old', createdAt: new Date(1) }),
      raw('b', { postId: 'new', createdAt: new Date(2) }),
    ]);
    expect(cases.map((c) => c.key)).toEqual(['post_new', 'post_old']);
  });
});

describe('fetchReportQueue', () => {
  it('reads open reports with author names and previews', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: 'r1',
          data: () => ({
            targetType: 'post',
            postId: 'p1',
            targetAuthorId: 'a',
            reason: 'spam',
            createdAt: ts(1),
          }),
        },
        {
          id: 'r2',
          data: () => ({
            targetType: 'comment',
            postId: 'p1',
            commentId: 'c1',
            targetAuthorId: 'a',
            reason: 'weird',
          }),
        },
        {
          id: 'r3',
          data: () => ({ targetType: 'member', targetAuthorId: 'gone', reason: 'other' }),
        },
        { id: 'bad', data: () => ({ targetType: 'post', targetAuthorId: 'a' }) },
      ],
    } as never);
    jest.mocked(getDoc).mockImplementation((async (ref: { path: string }) => {
      if (ref.path === 'members/a')
        return found({ displayName: 'Sample Author', photoURL: 'a.jpg' });
      if (ref.path === 'members/gone') return missing;
      if (ref.path === 'posts/p1')
        return found({ caption: 'Sample caption', photoPaths: ['x.jpg', 'y.jpg'] });
      if (ref.path === 'posts/p1/comments/c1') return missing;
      throw new Error(ref.path);
    }) as never);

    const queue = await fetchReportQueue();
    expect(jest.mocked(getDocs).mock.calls[0][0]).toMatchObject({
      path: 'reports',
      parts: [{ where: ['status', '==', 'open'] }],
    });
    const byKey = Object.fromEntries(queue.map((c) => [c.key, c]));
    expect(Object.keys(byKey).sort()).toEqual(['comment_p1_c1', 'member_gone', 'post_p1']);
    expect(byKey.post_p1).toMatchObject({
      authorName: 'Sample Author',
      authorPhotoURL: 'a.jpg',
      preview: { text: 'Sample caption', photoPath: 'x.jpg', photoCount: 2 },
    });
    expect(byKey.comment_p1_c1.preview).toBeNull();
    expect(byKey.comment_p1_c1.reasons).toEqual([{ reason: 'other', count: 1 }]);
    expect(byKey.member_gone).toMatchObject({ authorName: 'Former member', preview: null });
  });
});

describe('actions', () => {
  it('calls the Cloud Functions', async () => {
    expect(await resolveReportCase(['r1', 'r2'], 'removed')).toBe('d1');
    expect(httpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'resolveReport');
    expect(mockCall).toHaveBeenCalledWith({ reportIds: ['r1', 'r2'], action: 'removed' });
    await undoReportDecision('d1');
    expect(httpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'undoReportDecision');
    expect(mockCall).toHaveBeenLastCalledWith({ decisionId: 'd1' });
  });
});

describe('fetchMyRestriction', () => {
  const now = new Date(10_000);
  it('is the date posting resumes, or null when not paused or already over', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce(found({ until: ts(20_000) }) as never);
    expect(await fetchMyRestriction('me', now)).toEqual(new Date(20_000));
    jest.mocked(getDoc).mockResolvedValueOnce(found({ until: ts(5_000) }) as never);
    expect(await fetchMyRestriction('me', now)).toBeNull();
    jest.mocked(getDoc).mockResolvedValueOnce(missing as never);
    expect(await fetchMyRestriction('me', now)).toBeNull();
    expect(jest.mocked(getDoc).mock.calls[0][0]).toMatchObject({ path: 'restrictions/me' });
  });
});
