/** Test double for src/data/leadership.ts. Use with `jest.mock('@/data/leadership')`. */
import type { ChapterKpis, CurrentKpis, WaitingCounts } from '../leadership';

let counts: WaitingCounts = { membershipRequests: 0, openReports: 0 };
let kpis: CurrentKpis | null = null;
let failing = false;
let failingKpis = false;

export function sampleKpis(overrides: Partial<ChapterKpis> = {}): ChapterKpis {
  return {
    period: '2026-fall',
    label: 'Fall 2026',
    participationRate: 0.62,
    attendanceRate: 0.41,
    serviceHours: 128.5,
    activeMembers: 31,
    totalMembers: 42,
    eventsHeld: 9,
    goals: [
      {
        id: 'g1',
        name: 'Sample service hours',
        metric: 'service_hours',
        target: 500,
        unit: 'hours',
        value: 210,
        met: false,
      },
      {
        id: 'g2',
        name: 'Sample participation',
        metric: 'participation',
        target: 60,
        unit: 'percent',
        value: 64,
        met: true,
      },
    ],
    goalsDone: 1,
    goalsTotal: 2,
    ...overrides,
  };
}

export function sampleCurrentKpis(computedAt = new Date(Date.now() - 20 * 60_000)): CurrentKpis {
  return {
    periods: {
      semester: sampleKpis(),
      year: sampleKpis({ period: '2026-27', label: '2026-27 chapter year', serviceHours: 210 }),
      days30: sampleKpis({
        period: 'last-30-days',
        label: 'Last 30 days',
        participationRate: 0.33,
        attendanceRate: null,
        serviceHours: 12,
        activeMembers: 18,
        eventsHeld: 0,
      }),
    },
    computedAt,
  };
}

export function setMockWaiting(next: WaitingCounts) {
  counts = next;
}

export function failWaitingLoad() {
  failing = true;
}

export function setMockKpis(next: CurrentKpis | null) {
  kpis = next;
}

export function failKpisLoad() {
  failingKpis = true;
}

export const fetchWaitingCounts = jest.fn(async () => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  return counts;
});

export const fetchKpis = jest.fn(async () => {
  if (failingKpis) {
    failingKpis = false;
    throw new Error('offline');
  }
  return kpis;
});

export function resetLeadershipMock() {
  counts = { membershipRequests: 0, openReports: 0 };
  kpis = null;
  failing = false;
  failingKpis = false;
  fetchWaitingCounts.mockClear();
  fetchKpis.mockClear();
}
