import {
  getAggregateFromServer,
  getDoc,
  getDocs,
  orderBy,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

import {
  fetchEventDetail,
  fetchEventsBetween,
  fetchUpcomingEvents,
  RsvpSaveError,
  setRsvp,
  toEventSummary,
} from './events';

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
    collection: jest.fn((parent: { path?: string }, ...segments: string[]) => ({
      collection: [parent.path, ...segments].filter(Boolean).join('/'),
    })),
    doc: jest.fn((parent: { path?: string; collection?: string }, ...segments: string[]) => ({
      path: [parent.path ?? parent.collection, ...segments].filter(Boolean).join('/'),
    })),
    where: jest.fn((...args: unknown[]) => ({ where: args })),
    orderBy: jest.fn((...args: unknown[]) => ({ orderBy: args })),
    limit: jest.fn((n: number) => ({ limit: n })),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ref, parts })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    count: jest.fn(() => 'COUNT'),
    setDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'NOW'),
    getAggregateFromServer: jest.fn(),
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

describe('fetchEventDetail', () => {
  type Docs = Record<string, Record<string, unknown> | null>;
  function respond(docs: Docs, goingIds: string[], goingCount = goingIds.length) {
    jest.mocked(getDoc).mockImplementation(async (ref: unknown) => {
      const data = docs[(ref as { path: string }).path] ?? null;
      return { exists: () => data !== null, id: 'x', data: () => data ?? {} } as never;
    });
    jest.mocked(getDocs).mockResolvedValue({ docs: goingIds.map((id) => ({ id })) } as never);
    jest
      .mocked(getAggregateFromServer)
      .mockResolvedValue({ data: () => ({ count: goingCount }) } as never);
  }

  const gala = {
    title: 'Gala',
    category: 'fundraiser',
    startsAt: ts('2026-11-07T23:00:00Z'),
    rsvpDeadline: ts('2026-11-05T23:00:00Z'),
    location: 'Ballroom',
    address: '200 Sample Ave',
    feeCents: 2500,
    createdBy: 'host',
  };

  it('returns the event with host, my RSVP and who’s going', async () => {
    respond(
      {
        'events/gala': gala,
        'events/gala/rsvps/me': { status: 'maybe' },
        'members/host': { displayName: 'Jordan Hill', photoURL: 'https://cdn.test/h.jpg' },
        'members/a': { displayName: 'Marcus Reed' },
        'members/gone': null,
      },
      ['a', 'gone'],
      14,
    );
    const detail = await fetchEventDetail('gala', 'me');
    expect(detail).toMatchObject({
      id: 'gala',
      title: 'Gala',
      address: '200 Sample Ave',
      feeCents: 2500,
      rsvpDeadline: new Date('2026-11-05T23:00:00Z'),
      myRsvp: 'maybe',
      host: { uid: 'host', displayName: 'Jordan Hill', photoURL: 'https://cdn.test/h.jpg' },
      going: { count: 14, preview: [{ uid: 'a', displayName: 'Marcus Reed', photoURL: null }] },
    });
    expect(where).toHaveBeenCalledWith('status', '==', 'going');
  });

  it('is null for a missing event and tolerates a missing host and fee', async () => {
    respond({}, []);
    expect(await fetchEventDetail('nope', 'me')).toBeNull();
    respond({ 'events/gala': { ...gala, createdBy: 'ghost', feeCents: -1 } }, []);
    expect(await fetchEventDetail('gala', 'me')).toMatchObject({
      host: null,
      feeCents: 0,
      myRsvp: null,
      going: { count: 0, preview: [] },
    });
  });
});

describe('setRsvp', () => {
  it('writes only the member’s own RSVP doc, never attendance', async () => {
    jest.mocked(setDoc).mockResolvedValue(undefined);
    await setRsvp('gala', 'me', 'maybe');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'events/gala/rsvps/me' },
      { memberId: 'me', status: 'maybe', updatedAt: 'NOW' },
    );
  });

  it('reports a rules rejection as closed and anything else as failed', async () => {
    jest.mocked(setDoc).mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(setRsvp('gala', 'me', 'going')).rejects.toMatchObject({ reason: 'closed' });
    jest.mocked(setDoc).mockRejectedValueOnce({ code: 'unavailable' });
    await expect(setRsvp('gala', 'me', 'going')).rejects.toBeInstanceOf(RsvpSaveError);
  });
});
