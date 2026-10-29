import { getDoc, getDocs, orderBy, Timestamp, where } from 'firebase/firestore';

import { fetchEventsBetween, fetchUpcomingEvents, toEventSummary } from './events';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    mockMs: number;
    constructor(mockMs: number) {
      this.mockMs = mockMs;
    }
    static fromMillis(mockMs: number) {
      return new MockTimestamp(mockMs);
    }
    static fromDate(d: Date) {
      return new MockTimestamp(d.getTime());
    }
    toDate() {
      return new Date(this.mockMs);
    }
    toMillis() {
      return this.mockMs;
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
    doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    where: jest.fn((...args: unknown[]) => ({ where: args })),
    orderBy: jest.fn((...args: unknown[]) => ({ orderBy: args })),
    limit: jest.fn((n: number) => ({ limit: n })),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ref, parts })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
  };
});

const NOW = new Date('2026-10-29T17:00:00Z');
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

beforeEach(() => jest.clearAllMocks());

describe('toEventSummary', () => {
  it('maps an event document', () => {
    expect(
      toEventSummary(
        'e1',
        {
          title: ' Service day ',
          category: 'service',
          description: 'Sample',
          startsAt: ts('2026-11-07T14:00:00Z'),
          endsAt: ts('2026-11-07T17:00:00Z'),
          location: 'Park',
          photoURL: 'https://cdn.test/e1.jpg',
          cancelled: true,
        },
        'going',
      ),
    ).toEqual({
      id: 'e1',
      title: 'Service day',
      category: 'service',
      description: 'Sample',
      startsAt: new Date('2026-11-07T14:00:00Z'),
      endsAt: new Date('2026-11-07T17:00:00Z'),
      location: 'Park',
      photoURL: 'https://cdn.test/e1.jpg',
      cancelled: true,
      myRsvp: 'going',
    });
  });

  it('fills in safe defaults and skips events without a title or start', () => {
    expect(
      toEventSummary(
        'e',
        { title: 'X', startsAt: ts('2026-11-07T14:00:00Z'), category: '?' },
        null,
      ),
    ).toMatchObject({ category: 'meeting', endsAt: null, photoURL: null, cancelled: false });
    expect(toEventSummary('e', { title: 'X' }, null)).toBeNull();
    expect(toEventSummary('e', { startsAt: ts('2026-11-07T14:00:00Z') }, null)).toBeNull();
  });
});

describe('fetchUpcomingEvents', () => {
  function respond(
    events: Record<string, Record<string, unknown>>,
    rsvps: Record<string, string> = {},
  ) {
    jest.mocked(getDocs).mockResolvedValue({
      docs: Object.entries(events).map(([id, data]) => ({ id, data: () => data })),
    } as never);
    jest.mocked(getDoc).mockImplementation(async (ref: unknown) => {
      const id = (ref as { path: string }).path.split('/')[1];
      return {
        exists: () => id in rsvps,
        data: () => ({ status: rsvps[id] }),
      } as never;
    });
  }

  it('asks for events from the last day on, soonest first', async () => {
    respond({});
    await fetchUpcomingEvents('me', NOW);
    const [, , since] = jest.mocked(where).mock.calls[0] as unknown as [string, string, Timestamp];
    expect(jest.mocked(where).mock.calls[0].slice(0, 2)).toEqual(['startsAt', '>=']);
    expect(since.toMillis()).toBe(NOW.getTime() - 24 * 3600_000);
    expect(orderBy).toHaveBeenCalledWith('startsAt', 'asc');
  });

  it('adds the member’s own RSVP to each event', async () => {
    respond(
      {
        a: { title: 'A', startsAt: ts('2026-11-01T00:00:00Z') },
        b: { title: 'B', startsAt: ts('2026-11-02T00:00:00Z') },
        c: { title: 'C', startsAt: ts('2026-11-03T00:00:00Z') },
      },
      { a: 'maybe', c: 'nonsense' },
    );
    const events = await fetchUpcomingEvents('me', NOW);
    expect(getDoc).toHaveBeenCalledWith({ path: 'events/a/rsvps/me' });
    expect(events.map((e) => [e.id, e.myRsvp])).toEqual([
      ['a', 'maybe'],
      ['b', null],
      ['c', null],
    ]);
  });

  it('keeps an event that is still going on and drops ones that are over', async () => {
    respond({
      ongoing: {
        title: 'Ongoing',
        startsAt: ts('2026-10-29T16:00:00Z'),
        endsAt: ts('2026-10-29T18:00:00Z'),
      },
      over: {
        title: 'Over',
        startsAt: ts('2026-10-29T10:00:00Z'),
        endsAt: ts('2026-10-29T12:00:00Z'),
      },
      // No end time: counts as three hours long.
      noEndRecent: { title: 'Recent', startsAt: ts('2026-10-29T15:00:00Z') },
      noEndOld: { title: 'Old', startsAt: ts('2026-10-29T13:00:00Z') },
    });
    const events = await fetchUpcomingEvents('me', NOW);
    expect(events.map((e) => e.id)).toEqual(['ongoing', 'noEndRecent']);
  });

  it('fails when Firestore fails', async () => {
    jest.mocked(getDocs).mockRejectedValue(new Error('permission-denied'));
    await expect(fetchUpcomingEvents('me', NOW)).rejects.toThrow('permission-denied');
  });
});

describe('fetchEventsBetween', () => {
  it('asks for events starting in the range, past ones included', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      docs: [{ id: 'old', data: () => ({ title: 'Old', startsAt: ts('2026-10-02T00:00:00Z') }) }],
    } as never);
    jest
      .mocked(getDoc)
      .mockResolvedValue({ exists: () => true, data: () => ({ status: 'going' }) } as never);
    const from = new Date('2026-10-01T00:00:00Z');
    const to = new Date('2026-11-01T00:00:00Z');
    const events = await fetchEventsBetween('me', from, to);
    const calls = jest.mocked(where).mock.calls as unknown as [string, string, Timestamp][];
    expect(calls.map(([f, op, v]) => [f, op, v.toMillis()])).toEqual([
      ['startsAt', '>=', from.getTime()],
      ['startsAt', '<', to.getTime()],
    ]);
    expect(events.map((e) => [e.id, e.myRsvp])).toEqual([['old', 'going']]);
  });
});
