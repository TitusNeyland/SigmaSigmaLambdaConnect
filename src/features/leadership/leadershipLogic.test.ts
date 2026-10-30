import { sampleKpis } from '@/data/__mocks__/leadership';
import type { GoalResult } from '@/data/types';

import { goalProgress, goalsPercent, kpiTiles, updatedLabel } from './leadershipLogic';

describe('kpiTiles', () => {
  it('shows the four KPIs', () => {
    expect(kpiTiles(sampleKpis()).map((t) => [t.label, t.value, t.caption])).toEqual([
      ['Participation', '62%', 'Came to at least one event'],
      ['Attendance', '41%', 'Average per event · 9 events'],
      ['Service hours', '128.5', 'Logged at check-in'],
      ['Active members', '31', 'of 42 · checked in or posted'],
    ]);
  });

  it('says there were no events rather than showing 0%', () => {
    const [p, a] = kpiTiles(sampleKpis({ participationRate: null, attendanceRate: null }));
    expect([p.value, p.caption, a.value, a.caption]).toEqual([
      'None',
      'No events yet',
      'None',
      'No events yet',
    ]);
  });

  it('says "1 event"', () => {
    expect(kpiTiles(sampleKpis({ eventsHeld: 1 }))[1].caption).toBe('Average per event · 1 event');
  });
});

describe('goalsPercent', () => {
  it('is the share of goals met', () => {
    expect(goalsPercent(sampleKpis({ goalsDone: 1, goalsTotal: 3 }))).toBe(33);
    expect(goalsPercent(sampleKpis({ goalsDone: 0, goalsTotal: 0 }))).toBe(0);
  });
});

describe('goalProgress', () => {
  const g = (extra: Partial<GoalResult>): GoalResult => ({
    id: 'g',
    name: 'G',
    metric: 'service_hours',
    target: 500,
    unit: 'hours',
    value: 210,
    met: false,
    ...extra,
  });

  it('reads in the goal’s unit', () => {
    expect(goalProgress(g({}))).toBe('210 of 500 hours');
    expect(goalProgress(g({ value: 12.5 }))).toBe('12.5 of 500 hours');
    expect(
      goalProgress(g({ metric: 'participation', unit: 'percent', target: 60, value: 64.2 })),
    ).toBe('64% of 60%');
    expect(
      goalProgress(g({ metric: 'active_members', unit: 'count', target: 35, value: 30 })),
    ).toBe('30 of 35');
  });

  it('shows the target with no data yet, and done or not for custom goals', () => {
    expect(goalProgress(g({ value: null }))).toBe('Target 500 hours');
    expect(goalProgress(g({ metric: 'custom', met: true }))).toBe('Done');
    expect(goalProgress(g({ metric: 'custom', met: false }))).toBe('Not done');
  });
});

describe('updatedLabel', () => {
  const now = new Date(2026, 9, 29, 12);
  it.each([
    [0, 'Updated just now'],
    [20, 'Updated 20 min ago'],
    [180, 'Updated 3 hr ago'],
    [60 * 24 * 3, 'Updated Oct 26'],
  ])('%i minutes ago reads "%s"', (minutes, text) => {
    expect(updatedLabel(new Date(now.getTime() - minutes * 60_000), now)).toBe(text);
  });

  it('is empty without a time', () => {
    expect(updatedLabel(null, now)).toBe('');
  });
});
