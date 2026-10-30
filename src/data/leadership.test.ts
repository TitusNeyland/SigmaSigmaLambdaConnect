import { getCountFromServer, getDoc, Timestamp } from 'firebase/firestore';

import { fetchKpis, fetchWaitingCounts, toKpis } from './leadership';

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
    where: jest.fn((...a: unknown[]) => ({ where: a })),
    getCountFromServer: jest.fn(),
    getDoc: jest.fn(),
  };
});

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);
beforeEach(() => jest.clearAllMocks());

const period = (extra: object = {}) => ({
  period: '2026-fall',
  label: 'Fall 2026',
  participationRate: 0.5,
  attendanceRate: null,
  serviceHours: 9,
  activeMembers: 3,
  totalMembers: 4,
  eventsHeld: 2,
  goals: [
    {
      id: 'g',
      name: 'Hours',
      metric: 'service_hours',
      target: 10,
      unit: 'hours',
      value: 9,
      met: false,
    },
  ],
  ...extra,
});

it('counts pending members and open reports', async () => {
  jest
    .mocked(getCountFromServer)
    .mockResolvedValueOnce({ data: () => ({ count: 2 }) } as never)
    .mockResolvedValueOnce({ data: () => ({ count: 1 }) } as never);
  expect(await fetchWaitingCounts()).toEqual({ membershipRequests: 2, openReports: 1 });
  const [requests, reports] = jest.mocked(getCountFromServer).mock.calls.map((c) => c[0]);
  expect(requests).toMatchObject({
    path: 'members',
    parts: [{ where: ['status', '==', 'pending'] }],
  });
  expect(reports).toMatchObject({ path: 'reports', parts: [{ where: ['status', '==', 'open'] }] });
});

describe('fetchKpis', () => {
  it('reads all three periods from kpis/current', async () => {
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        semester: period(),
        year: period({ period: '2026-27' }),
        days30: period({ period: 'last-30-days' }),
        computedAt: ts(1000),
      }),
    } as never);
    const k = await fetchKpis();
    expect(jest.mocked(getDoc).mock.calls[0][0]).toMatchObject({ path: 'kpis/current' });
    expect(k?.computedAt).toEqual(new Date(1000));
    expect(k?.periods.year.period).toBe('2026-27');
    expect(k?.periods.semester).toMatchObject({
      attendanceRate: null,
      goalsDone: 0,
      goalsTotal: 1,
    });
  });

  it('is null before the function has run, or if a period is missing', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);
    expect(await fetchKpis()).toBeNull();
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ semester: period() }),
    } as never);
    expect(await fetchKpis()).toBeNull();
  });
});

describe('toKpis', () => {
  it('fills in missing numbers and drops bad goals', () => {
    expect(
      toKpis({
        period: 'x',
        serviceHours: 'lots',
        goals: [null, { id: 1 }, { id: 'ok', name: 'Ok', met: true }],
      }),
    ).toEqual({
      period: 'x',
      label: 'x',
      participationRate: null,
      attendanceRate: null,
      serviceHours: 0,
      activeMembers: 0,
      totalMembers: 0,
      eventsHeld: 0,
      goals: [
        {
          id: 'ok',
          name: 'Ok',
          metric: undefined,
          target: 0,
          unit: 'count',
          value: null,
          met: true,
        },
      ],
      goalsDone: 1,
      goalsTotal: 1,
    });
  });

  it('rejects things that are not a period', () => {
    expect(toKpis(null)).toBeNull();
    expect(toKpis({ label: 'no id' })).toBeNull();
  });
});
