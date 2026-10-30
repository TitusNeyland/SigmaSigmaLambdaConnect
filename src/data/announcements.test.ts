import { addDoc, onSnapshot, orderBy, setDoc, Timestamp } from 'firebase/firestore';

import {
  markRead,
  postAnnouncement,
  subscribeToAnnouncements,
  subscribeToReads,
  toAnnouncement,
} from './announcements';

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
    onSnapshot: jest.fn(),
    addDoc: jest.fn(),
    setDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);
beforeEach(() => jest.clearAllMocks());

it('maps an announcement and skips one without a title', () => {
  expect(
    toAnnouncement('a', {
      title: ' Dues ',
      body: ' Pay ',
      pinned: true,
      createdAt: ts(5),
      authorTitle: 'Treasurer',
      authorId: 'k',
    }),
  ).toEqual({
    id: 'a',
    title: 'Dues',
    body: 'Pay',
    authorId: 'k',
    authorTitle: 'Treasurer',
    pinned: true,
    createdAt: new Date(5),
  });
  expect(toAnnouncement('a', { title: '' })).toBeNull();
});

it('lists newest first, live', () => {
  const onChange = jest.fn();
  subscribeToAnnouncements(onChange, jest.fn());
  expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  const next = jest.mocked(onSnapshot).mock.calls[0][1] as unknown as (s: object) => void;
  next({
    docs: [
      { id: 'a', data: () => ({ title: 'A', createdAt: ts(1) }) },
      { id: 'b', data: () => ({}) },
    ],
  });
  expect(onChange.mock.calls[0][0].map((x: { id: string }) => x.id)).toEqual(['a']);
});

it('tracks reads for the member only', async () => {
  const onChange = jest.fn();
  subscribeToReads('me', onChange, jest.fn());
  const next = jest.mocked(onSnapshot).mock.calls[0][1] as unknown as (s: object) => void;
  next({ docs: [{ id: 'a' }] });
  expect(onChange).toHaveBeenCalledWith(new Set(['a']));
  await markRead('me', 'a');
  expect(setDoc).toHaveBeenCalledWith({ path: 'reads/me/announcements/a' }, { readAt: 'NOW' });
});

it('posts with exactly the fields the rules allow', async () => {
  await postAnnouncement('olivia', {
    title: ' Dues ',
    body: ' Pay ',
    pinned: false,
    authorTitle: 'Treasurer',
  });
  expect(addDoc).toHaveBeenCalledWith(
    { path: 'announcements' },
    {
      title: 'Dues',
      body: 'Pay',
      authorId: 'olivia',
      authorTitle: 'Treasurer',
      pinned: false,
      createdAt: 'NOW',
    },
  );
  await postAnnouncement('olivia', { title: 'x', body: 'y', pinned: false, authorTitle: ' ' });
  expect(jest.mocked(addDoc).mock.calls[1][1]).not.toHaveProperty('authorTitle');
});
