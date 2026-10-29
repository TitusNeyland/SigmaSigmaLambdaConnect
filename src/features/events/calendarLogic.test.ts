import type { EventSummary } from '@/data/events';

import {
  addMonths,
  dayKey,
  defaultDay,
  eventsByDay,
  longDay,
  monthGrid,
  monthOf,
  monthRange,
  monthTitle,
} from './calendarLogic';

const event = (id: string, startsAt: Date): EventSummary => ({
  id,
  title: id,
  category: 'meeting',
  description: '',
  startsAt,
  endsAt: null,
  location: '',
  photoURL: null,
  cancelled: false,
  myRsvp: null,
});

const NOV_2026 = { year: 2026, month: 10 };

describe('months', () => {
  it('moves across year boundaries', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths(NOV_2026, 0)).toEqual(NOV_2026);
  });

  it('titles and ranges a month in device time', () => {
    expect(monthTitle(NOV_2026)).toBe('November 2026');
    expect(monthRange(NOV_2026)).toEqual({
      from: new Date(2026, 10, 1),
      to: new Date(2026, 11, 1),
    });
    expect(monthOf(new Date(2026, 10, 30, 23))).toEqual(NOV_2026);
  });

  it('keys days with zero padding', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('formats the selected day', () => {
    expect(longDay(new Date(2026, 10, 7))).toBe('Saturday, November 7');
  });
});

describe('monthGrid', () => {
  it('starts on Sunday and pads both ends', () => {
    // November 2026 starts on a Sunday and has 30 days.
    const weeks = monthGrid(NOV_2026);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]?.getDate()).toBe(1);
    expect(weeks[4].map((d) => d?.getDate() ?? null)).toEqual([
      29,
      30,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('pads the first week when the month starts midweek', () => {
    // October 2026 starts on a Thursday.
    const weeks = monthGrid({ year: 2026, month: 9 });
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[0][4]?.getDate()).toBe(1);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it('handles February in a leap year', () => {
    expect(monthGrid({ year: 2028, month: 1 }).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('eventsByDay and defaultDay', () => {
  const late = event('late', new Date(2026, 10, 7, 19));
  const early = event('early', new Date(2026, 10, 7, 9));
  const other = event('other', new Date(2026, 10, 12, 18));
  const byDay = eventsByDay([late, other, early]);

  it('groups by day in time order', () => {
    expect([...byDay.keys()]).toEqual(['2026-11-07', '2026-11-12']);
    expect(byDay.get('2026-11-07')?.map((e) => e.id)).toEqual(['early', 'late']);
  });

  it('opens on today when it is in the month', () => {
    expect(defaultDay(NOV_2026, new Date(2026, 10, 20, 15), byDay)).toEqual(new Date(2026, 10, 20));
  });

  it('otherwise opens on the first day with an event, or the 1st', () => {
    const today = new Date(2026, 9, 29);
    expect(defaultDay(NOV_2026, today, byDay)).toEqual(new Date(2026, 10, 7));
    expect(defaultDay(NOV_2026, today, new Map())).toEqual(new Date(2026, 10, 1));
  });
});
