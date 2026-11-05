import { sampleKpis } from '@/data/__mocks__/leadership';
import { sampleProgram } from '@/data/__mocks__/programs';
import type { GoalResult } from '@/data/types';

import { PROGRAMS } from '../../../tools/seed/data';

import {
  chapterHealth,
  elapsed,
  goalHealth,
  healthLine,
  paceHealth,
  programHealth,
  YELLOW_POINTS,
} from './healthLogic';

// UTC, so the daylight saving change in November doesn't shift "halfway".
const day = (n: number) => new Date(Date.UTC(2026, 7, 1 + n));
const NOW = day(50);
const ms = (done: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({
    id: `m${i}`,
    name: `Step ${i}`,
    order: i,
    done: i < done,
  }));

describe('elapsed', () => {
  it('is the share of time gone, kept between 0 and 1', () => {
    expect(elapsed(day(0), day(100), NOW)).toBeCloseTo(0.5);
    expect(elapsed(day(60), day(100), NOW)).toBe(0);
    expect(elapsed(day(0), day(10), NOW)).toBe(1);
  });

  it('is unknown without a usable span', () => {
    expect(elapsed(null, day(10), NOW)).toBeNull();
    expect(elapsed(day(10), day(10), NOW)).toBeNull();
  });
});

describe('paceHealth', () => {
  it('is green on pace, yellow up to 15 points behind, then red', () => {
    expect(YELLOW_POINTS).toBe(15);
    expect(paceHealth(0.5, 0.5)).toBe('green');
    expect(paceHealth(0.6, 0.5)).toBe('green');
    expect(paceHealth(0.35, 0.5)).toBe('yellow');
    expect(paceHealth(0.34, 0.5)).toBe('red');
  });
});

describe('programHealth', () => {
  const program = (o: Parameters<typeof sampleProgram>[0]) =>
    sampleProgram({ createdAt: day(0), dueAt: day(100), ...o });

  it('compares milestones done with how many should be done by now', () => {
    // Halfway to its due date: 2 of 4 should be done.
    expect(programHealth(program({ milestones: ms(2, 4) }), NOW, null)).toMatchObject({
      health: 'green',
      label: 'On track',
      percent: 50,
      note: 'Expected 2 of 4 milestones by now',
    });
    // One milestone behind is yellow, more is red.
    expect(programHealth(program({ milestones: ms(1, 4) }), NOW, null)).toMatchObject({
      health: 'yellow',
      label: 'Behind',
    });
    expect(programHealth(program({ milestones: ms(0, 4) }), NOW, null)).toMatchObject({
      health: 'red',
      label: 'At risk',
    });
    // Up to 15 points behind is still yellow, even past one milestone.
    expect(programHealth(program({ milestones: ms(7, 20) }), NOW, null).health).toBe('yellow');
    expect(programHealth(program({ milestones: ms(6, 20) }), NOW, null).health).toBe('red');
  });

  it('is done when every milestone is, even if past due', () => {
    expect(
      programHealth(program({ milestones: ms(4, 4), dueAt: day(10) }), NOW, null),
    ).toMatchObject({ health: 'green', label: 'Done', percent: 100 });
  });

  it('is red when flagged as needing help or past due', () => {
    expect(
      programHealth(program({ status: 'at_risk', milestones: ms(4, 5) }), NOW, null),
    ).toMatchObject({ health: 'red', note: 'Flagged as needing help' });
    expect(
      programHealth(program({ dueAt: day(40), milestones: ms(3, 4) }), NOW, null),
    ).toMatchObject({
      health: 'red',
      note: 'Past its due date',
    });
  });

  it('measures from the start of the chapter year when it has no start date', () => {
    const p = program({ createdAt: null, milestones: ms(0, 4) });
    expect(programHealth(p, NOW, day(0)).health).toBe('red');
    expect(programHealth(p, NOW, null)).toMatchObject({ health: 'none', note: 'No start date' });
  });

  it('a program just started is on track', () => {
    expect(
      programHealth(program({ createdAt: day(49), milestones: ms(0, 4) }), NOW, null).health,
    ).toBe('green');
  });
});

describe('goalHealth', () => {
  const goal = (o: Partial<GoalResult>): GoalResult => ({
    id: 'g',
    name: 'Goal',
    metric: 'service_hours',
    target: 500,
    unit: 'hours',
    value: 0,
    met: false,
    ...o,
  });

  it('compares hours and counts with how much should be done by now', () => {
    expect(goalHealth(goal({ value: 260 }), 0.5)).toMatchObject({
      health: 'green',
      note: 'Expected 250 hours by now',
      progress: '260 of 500 hours',
    });
    expect(goalHealth(goal({ value: 200 }), 0.5).health).toBe('yellow');
    expect(goalHealth(goal({ value: 100 }), 0.5).health).toBe('red');
    expect(
      goalHealth(goal({ metric: 'active_members', unit: 'count', target: 40, value: 10 }), 0.5),
    ).toMatchObject({ health: 'red', note: 'Expected 20 by now' });
  });

  it('compares percent goals straight to the target', () => {
    const rate = (value: number) =>
      goalHealth(goal({ metric: 'attendance', unit: 'percent', target: 75, value }), 0.1);
    expect(rate(75).health).toBe('green');
    expect(rate(61).health).toBe('yellow');
    expect(rate(59).health).toBe('red');
    expect(rate(61).note).toBe('Target 75%');
  });

  it('met goals are green, and goals without numbers yet have no status', () => {
    expect(goalHealth(goal({ met: true }), 0.5)).toMatchObject({ health: 'green', label: 'Met' });
    expect(goalHealth(goal({ value: null }), 0.5).health).toBe('none');
  });

  it('custom goals are done or not, and red only once the year is over', () => {
    const custom = goal({ metric: 'custom', unit: 'count', value: null });
    expect(goalHealth(custom, 0.5)).toMatchObject({ health: 'none', label: 'Not done yet' });
    expect(goalHealth(custom, 1).health).toBe('red');
  });
});

describe('healthLine', () => {
  it('counts on track, behind and at risk, leaving out zeros', () => {
    expect(healthLine({ green: 5, yellow: 0, red: 1, none: 2 })).toBe('5 on track · 1 at risk');
    expect(healthLine({ green: 0, yellow: 0, red: 0, none: 3 })).toBe('Nothing to track yet');
  });
});

describe('chapterHealth', () => {
  it('puts programs and goals worst first and counts them together', () => {
    const year = sampleKpis({ start: day(0), end: day(100) });
    const health = chapterHealth(
      [
        sampleProgram({ id: 'ok', createdAt: day(0), dueAt: day(100), milestones: ms(3, 4) }),
        sampleProgram({ id: 'late', createdAt: day(0), dueAt: day(40), milestones: ms(1, 4) }),
      ],
      year,
      NOW,
    );
    expect(health.programs.map((p) => p.id)).toEqual(['late', 'ok']);
    // Sample goals: 210 of 500 hours at halfway is 8 points behind (yellow), and
    // participation 64% against 60% is met.
    expect(health.goals.map((g) => [g.id, g.health])).toEqual([
      ['g1', 'yellow'],
      ['g2', 'green'],
    ]);
    expect(health.counts).toEqual({ green: 2, yellow: 1, red: 1, none: 0 });
    expect(health.programsPercent).toBe(50);
    expect(health.yearPercent).toBe(50);
    expect(health.goalsMet).toBe(1);
  });

  it('copes with no numbers yet', () => {
    const health = chapterHealth([], null, NOW);
    expect(health).toMatchObject({ goals: [], goalsTotal: 0, yearPercent: null });
  });
});

describe('the sample data in tools/seed', () => {
  it('shows every color, so the screen can be checked in dev', () => {
    const start = Date.UTC(2026, 10, 5);
    const at = (days: number) => new Date(start + days * 86_400_000);
    const health = PROGRAMS.map(
      (p) =>
        programHealth(
          sampleProgram({
            id: p.id,
            status: p.status,
            createdAt: at(-p.startedDaysAgo),
            dueAt: at(p.dueInDays),
            milestones: p.milestones.map(([name, done], i) => ({
              id: `m${i}`,
              name,
              order: i,
              done,
            })),
          }),
          at(0),
          null,
        ).health,
    );
    expect(new Set(health)).toEqual(new Set(['green', 'yellow', 'red']));
  });
});
