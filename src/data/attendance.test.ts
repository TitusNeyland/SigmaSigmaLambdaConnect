import { getDoc, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { fetchAttendanceEvents, fetchRoster, saveAttendance } from './attendance';

jest.mock('./firebase', () => ({ db: { name: 'db' }, functions: { name: 'functions' } }));
jest.mock('./directory', () => ({
  fetchDirectory: jest.fn(async () => [
    { uid: 'b', displayName: 'Sample Bee', photoURL: null },
    { uid: 'a', displayName: 'Sample Ace', photoURL: 'a.jpg' },
    { uid: 'c', displayName: 'Sample Cee', photoURL: null },
  ]),
}));
const mockBatch = { set: jest.fn(), delete: jest.fn(), commit: jest.fn(async () => {}) };
const mockCall = jest.fn(async () => ({ data: { ok: true } }));
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
    static fromMillis(ms: number) {
      return new MockTimestamp(ms);
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((base: { path?: string }, ...s: string[]) => ({
      path: [base.path, ...s].filter(Boolean).join('/'),
    })),
    doc: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ...ref, parts })),
    where: jest.fn((...a: unknown[]) => ({ where: a })),
    orderBy: jest.fn((...a: unknown[]) => ({ orderBy: a })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    writeBatch: jest.fn(() => mockBatch),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});

const ts = (ms: number) =>
  (Timestamp as unknown as { fromMillis(ms: number): Timestamp }).fromMillis(ms);
const snap = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
  get: (k: string) => data[k],
});
beforeEach(() => jest.clearAllMocks());

it('lists recent and upcoming events, newest first, without cancelled ones', async () => {
  jest.mocked(getDocs).mockResolvedValue({
    docs: [
      snap('e1', { title: 'Sample meeting', startsAt: ts(2000), location: 'Hall' }),
      snap('e2', { title: 'Sample cancelled', startsAt: ts(1000), cancelled: true }),
      snap('e3', { startsAt: ts(500) }),
    ],
  } as never);
  const now = new Date(14 * 86_400_000);
  expect(await fetchAttendanceEvents(now)).toEqual([
    { id: 'e1', title: 'Sample meeting', startsAt: new Date(2000), location: 'Hall' },
  ]);
  expect(jest.mocked(getDocs).mock.calls[0][0]).toMatchObject({
    path: 'events',
    parts: [
      { where: ['startsAt', '>=', ts(0)] },
      { where: ['startsAt', '<=', ts(15 * 86_400_000)] },
      { orderBy: ['startsAt', 'desc'] },
    ],
  });
});

describe('fetchRoster', () => {
  it('joins members with their RSVP and check-in, sorted by name', async () => {
    jest.mocked(getDoc).mockResolvedValue({
      id: 'e1',
      exists: () => true,
      data: () => ({ title: 'Sample meeting', startsAt: ts(2000) }),
    } as never);
    jest
      .mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [snap('a', { status: 'going' }), snap('c', { status: 'maybe' })],
      } as never)
      .mockResolvedValueOnce({ docs: [snap('a', { serviceHours: 2 }), snap('b', {})] } as never);
    const roster = await fetchRoster('e1');
    expect(roster?.event.title).toBe('Sample meeting');
    expect(roster?.members).toEqual([
      {
        uid: 'a',
        displayName: 'Sample Ace',
        photoURL: 'a.jpg',
        rsvp: 'going',
        checkedIn: true,
        serviceHours: 2,
      },
      {
        uid: 'b',
        displayName: 'Sample Bee',
        photoURL: null,
        rsvp: null,
        checkedIn: true,
        serviceHours: null,
      },
      {
        uid: 'c',
        displayName: 'Sample Cee',
        photoURL: null,
        rsvp: 'maybe',
        checkedIn: false,
        serviceHours: null,
      },
    ]);
    expect(
      jest.mocked(getDocs).mock.calls.map((c) => (c[0] as unknown as { path: string }).path),
    ).toEqual(['events/e1/rsvps', 'events/e1/attendance']);
  });

  it('is null for an event that no longer exists', async () => {
    jest.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    jest.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
    expect(await fetchRoster('gone')).toBeNull();
  });
});

describe('saveAttendance', () => {
  it('writes check-ins in the shape the rules allow, undoes removals, then refreshes KPIs', async () => {
    await saveAttendance('e1', 'olivia', {
      checkIn: [
        { uid: 'a', walkIn: false },
        { uid: 'x', walkIn: true },
      ],
      remove: ['b'],
      serviceHours: 2,
    });
    expect(mockBatch.set).toHaveBeenCalledWith(
      { path: 'events/e1/attendance/a' },
      { memberId: 'a', checkedInBy: 'olivia', checkedInAt: 'NOW', walkIn: false, serviceHours: 2 },
    );
    expect(mockBatch.set).toHaveBeenCalledWith(
      { path: 'events/e1/attendance/x' },
      expect.objectContaining({ memberId: 'x', walkIn: true }),
    );
    expect(mockBatch.delete).toHaveBeenCalledWith({ path: 'events/e1/attendance/b' });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(httpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'refreshKpis');
    expect(mockCall).toHaveBeenCalled();
  });

  it('logs no hours when there are none', async () => {
    await saveAttendance('e1', 'olivia', {
      checkIn: [{ uid: 'a', walkIn: false }],
      remove: [],
      serviceHours: null,
    });
    expect(mockBatch.set.mock.calls[0][1]).not.toHaveProperty('serviceHours');
  });

  it('splits big saves into batches', async () => {
    const checkIn = Array.from({ length: 450 }, (_, i) => ({ uid: `m${i}`, walkIn: false }));
    await saveAttendance('e1', 'olivia', { checkIn, remove: [], serviceHours: null });
    expect(writeBatch).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
  });

  it('still succeeds if the KPI refresh fails', async () => {
    mockCall.mockRejectedValueOnce(new Error('unavailable') as never);
    await expect(
      saveAttendance('e1', 'olivia', { checkIn: [], remove: ['a'], serviceHours: null }),
    ).resolves.toBeUndefined();
  });

  it('fails if the write fails, before refreshing', async () => {
    mockBatch.commit.mockRejectedValueOnce(new Error('offline') as never);
    await expect(
      saveAttendance('e1', 'olivia', { checkIn: [], remove: ['a'], serviceHours: null }),
    ).rejects.toThrow('offline');
    expect(mockCall).not.toHaveBeenCalled();
  });
});
