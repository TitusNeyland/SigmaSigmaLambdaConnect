import { describe, expect, it } from 'vitest';

import { currentPeriods, evaluateGoals, localMidnight, summarize, type Metrics } from './kpis';

describe('localMidnight', () => {
  it('is midnight Central, in both CDT and CST', () => {
    expect(localMidnight(2026, 7, 1).toISOString()).toBe('2026-08-01T05:00:00.000Z');
    expect(localMidnight(2027, 0, 1).toISOString()).toBe('2027-01-01T06:00:00.000Z');
  });

  it('handles the day daylight saving starts and ends', () => {
    expect(localMidnight(2026, 2, 8).toISOString()).toBe('2026-03-08T06:00:00.000Z');
    expect(localMidnight(2026, 10, 1).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });
});

describe('currentPeriods', () => {
  it('puts late October in fall and the 2026-27 chapter year', () => {
    const now = new Date('2026-10-29T17:00:00Z');
    const p = currentPeriods(now);
    expect(p.semester).toMatchObject({ id: '2026-fall', label: 'Fall 2026' });
    expect(p.semester.start.toISOString()).toBe('2026-08-01T05:00:00.000Z');
    expect(p.semester.end.toISOString()).toBe('2027-01-01T06:00:00.000Z');
    expect(p.year).toMatchObject({ id: '2026-27', label: '2026-27 chapter year' });
    expect(p.year.end.toISOString()).toBe('2027-08-01T05:00:00.000Z');
    expect(p.days30.id).toBe('last-30-days');
    expect(p.days30.end).toEqual(now);
    expect(now.getTime() - p.days30.start.getTime()).toBe(30 * 86_400_000);
  });

  it('puts March in spring and the chapter year that began the August before', () => {
    const p = currentPeriods(new Date('2027-03-10T12:00:00Z'));
    expect(p.semester).toMatchObject({ id: '2027-spring', label: 'Spring 2027' });
    expect(p.semester.end.toISOString()).toBe('2027-08-01T05:00:00.000Z');
    expect(p.year.id).toBe('2026-27');
  });

  it('uses the chapter’s date, not UTC, at the year boundary', () => {
    // 11 PM Central on Jul 31 is already Aug 1 in UTC; still the old year.
    const p = currentPeriods(new Date('2027-08-01T04:00:00Z'));
    expect(p.year.id).toBe('2026-27');
    expect(p.semester.id).toBe('2027-spring');
    expect(currentPeriods(new Date('2027-08-01T05:00:00Z')).year.id).toBe('2027-28');
  });

  it('pads the short year at the turn of a century-ish boundary', () => {
    expect(currentPeriods(new Date('2099-09-01T12:00:00Z')).year.id).toBe('2099-00');
  });
});

describe('summarize', () => {
  const approved = new Set(['a', 'b', 'c', 'd']);

  it('uses check-ins for participation and attendance', () => {
    const m = summarize({
      approved,
      events: [
        { id: 'e1', checkIns: [{ memberId: 'a' }, { memberId: 'b' }] },
        {
          id: 'e2',
          checkIns: [
            { memberId: 'a', serviceHours: 3 },
            { memberId: 'c', serviceHours: 2.5 },
          ],
        },
      ],
      posters: new Set(),
    });
    expect(m).toEqual({
      participationRate: 0.75,
      attendanceRate: 0.5,
      serviceHours: 5.5,
      activeMembers: 3,
      totalMembers: 4,
      eventsHeld: 2,
    });
  });

  it('counts posters as active but not as attending', () => {
    const m = summarize({
      approved,
      events: [{ id: 'e1', checkIns: [{ memberId: 'a' }] }],
      posters: new Set(['a', 'd', 'gone']),
    });
    expect(m.activeMembers).toBe(2);
    expect(m.participationRate).toBe(0.25);
  });

  it('ignores people who are no longer approved, and bad hours', () => {
    const m = summarize({
      approved,
      events: [
        {
          id: 'e1',
          checkIns: [
            { memberId: 'gone', serviceHours: 5 },
            { memberId: 'a', serviceHours: -2 },
            { memberId: 'b', serviceHours: 'lots' },
            { memberId: 'c', serviceHours: 99 },
          ],
        },
      ],
      posters: new Set(),
    });
    expect(m.serviceHours).toBe(0);
    expect(m.attendanceRate).toBe(0.75);
  });

  it('reports no rates when nothing was held', () => {
    expect(summarize({ approved, events: [], posters: new Set(['a']) })).toMatchObject({
      participationRate: null,
      attendanceRate: null,
      activeMembers: 1,
      eventsHeld: 0,
    });
  });

  it('copes with no members', () => {
    const m = summarize({
      approved: new Set(),
      events: [{ id: 'e', checkIns: [] }],
      posters: new Set(),
    });
    expect(m.participationRate).toBe(0);
    expect(m.attendanceRate).toBe(0);
  });
});

describe('evaluateGoals', () => {
  const year: Metrics = {
    participationRate: 0.62,
    attendanceRate: 0.4,
    serviceHours: 120,
    activeMembers: 30,
    totalMembers: 40,
    eventsHeld: 8,
  };
  const goal = (id: string, data: Record<string, unknown>) => ({ id, data });

  it('checks each goal against the chapter year, in the goal’s unit', () => {
    const results = evaluateGoals(
      [
        goal('p', { name: 'Participation', metric: 'participation', target: 60, unit: 'percent' }),
        goal('a', { name: 'Attendance', metric: 'attendance', target: 50, unit: 'percent' }),
        goal('s', { name: 'Service hours', metric: 'service_hours', target: 100, unit: 'hours' }),
        goal('m', { name: 'Members active', metric: 'active_members', target: 35, unit: 'count' }),
        goal('c', {
          name: 'Chapter retreat',
          metric: 'custom',
          target: 1,
          unit: 'count',
          done: true,
        }),
      ],
      year,
    );
    expect(results.map((r) => [r.id, r.value, r.met])).toEqual([
      ['a', 40, false],
      ['c', null, true],
      ['m', 30, false],
      ['p', 62, true],
      ['s', 120, true],
    ]);
  });

  it('is not met when there is no data yet', () => {
    const [r] = evaluateGoals(
      [goal('p', { name: 'Participation', metric: 'participation', target: 0 })],
      { ...year, participationRate: null },
    );
    expect(r).toMatchObject({ value: null, met: false });
  });

  it('skips malformed goals', () => {
    expect(
      evaluateGoals(
        [
          goal('x', { name: '', metric: 'participation', target: 50 }),
          goal('y', { name: 'Y', metric: 'dues', target: 50 }),
          goal('z', { name: 'Z', metric: 'service_hours', target: 'lots' }),
        ],
        year,
      ),
    ).toEqual([]);
  });
});
