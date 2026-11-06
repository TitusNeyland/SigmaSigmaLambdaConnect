import { getDoc, getDocs, limit, orderBy, setDoc, Timestamp } from 'firebase/firestore';

import { fetchActivity, fetchActivitySeen, markActivitySeen, toActivityItem } from './activity';

// jest.setup.js mocks this module for screen tests; test the real one here.
jest.unmock('./activity');
jest.mock('./firebase', () => ({ db: { name: 'db' } }));
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
    orderBy: jest.fn((...a: unknown[]) => ({ orderBy: a })),
    limit: jest.fn((n: number) => ({ limit: n })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);
beforeEach(() => jest.clearAllMocks());

it('maps an item and skips ones it can’t show', () => {
  expect(
    toActivityItem('comment_c1', {
      type: 'comment',
      actorId: 'chris',
      actorName: ' Sample Chris ',
      actorPhotoURL: null,
      postId: 'p1',
      commentId: 'c1',
      text: 'Great night',
      photoPath: 'posts/a/p1/0.jpg',
      at: ts(5),
    }),
  ).toEqual({
    id: 'comment_c1',
    type: 'comment',
    actorId: 'chris',
    actorName: 'Sample Chris',
    actorPhotoURL: null,
    postId: 'p1',
    commentId: 'c1',
    text: 'Great night',
    photoPath: 'posts/a/p1/0.jpg',
    eventId: null,
    announcementId: null,
    title: '',
    startsAt: null,
    at: new Date(5),
  });
  expect(toActivityItem('l', { type: 'like', actorId: 'c', postId: 'p', at: ts(1) })).toMatchObject(
    { actorName: 'A brother', commentId: null, text: '', photoPath: null },
  );
  expect(toActivityItem('x', { type: 'mention', actorId: 'c', postId: 'p', at: ts(1) })).toBeNull();
  expect(toActivityItem('x', { type: 'like', actorId: 'c', postId: 'p' })).toBeNull();
  // Things people do need who did them.
  expect(toActivityItem('x', { type: 'tag', postId: 'p', at: ts(1) })).toBeNull();
});

it('maps the chapter’s own notices, which have no person behind them', () => {
  expect(
    toActivityItem('reminder_e1', {
      type: 'event_reminder',
      actorId: '',
      eventId: 'e1',
      title: 'Gala',
      startsAt: ts(9),
      at: ts(5),
    }),
  ).toMatchObject({
    actorId: '',
    actorName: '',
    eventId: 'e1',
    title: 'Gala',
    startsAt: new Date(9),
  });
  expect(toActivityItem('approved', { type: 'approved', at: ts(5) })).toMatchObject({
    type: 'approved',
    postId: null,
  });
  expect(
    toActivityItem('announcement_a1', {
      type: 'announcement',
      actorId: 'm',
      actorName: 'Sample Marcus',
      announcementId: 'a1',
      title: 'Dues',
      at: ts(5),
    }),
  ).toMatchObject({ announcementId: 'a1', actorName: 'Sample Marcus' });
  expect(toActivityItem('x', { type: 'event_reminder', at: ts(5) })).toBeNull();
  expect(toActivityItem('x', { type: 'announcement', at: ts(5) })).toBeNull();
});

it('reads the member’s own Activity, newest first', async () => {
  jest.mocked(getDocs).mockResolvedValue({
    docs: [
      { id: 'a', data: () => ({ type: 'like', actorId: 'c', postId: 'p', at: ts(2) }) },
      { id: 'b', data: () => ({}) },
    ],
  } as never);
  const items = await fetchActivity('me');
  expect(items.map((i) => i.id)).toEqual(['a']);
  expect(jest.mocked(getDocs).mock.calls[0][0]).toMatchObject({ path: 'activity/me/items' });
  expect(orderBy).toHaveBeenCalledWith('at', 'desc');
  expect(limit).toHaveBeenCalledWith(50);
});

it('reads and records when the member last looked', async () => {
  jest.mocked(getDoc).mockResolvedValueOnce({ get: () => ts(9) } as never);
  expect(await fetchActivitySeen('me')).toEqual(new Date(9));
  jest.mocked(getDoc).mockResolvedValueOnce({ get: () => undefined } as never);
  expect(await fetchActivitySeen('me')).toBeNull();
  await markActivitySeen('me');
  expect(setDoc).toHaveBeenCalledWith({ path: 'activity/me' }, { seenAt: 'NOW' });
});
