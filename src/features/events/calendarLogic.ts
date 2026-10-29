import type { EventSummary } from '@/data/events';

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A month as { year, month } with month 0 to 11, like Date. */
export type Month = { year: number; month: number };

export const monthOf = (date: Date): Month => ({
  year: date.getFullYear(),
  month: date.getMonth(),
});

/** Moves by whole months, wrapping the year. */
export function addMonths({ year, month }: Month, delta: number): Month {
  const d = new Date(year, month + delta, 1);
  return monthOf(d);
}

/** "November 2026". */
export const monthTitle = ({ year, month }: Month) => `${MONTH_NAMES[month]} ${year}`;

/** First instant of the month and of the next one, in device time, for the range query. */
export function monthRange({ year, month }: Month): { from: Date; to: Date } {
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) };
}

/** "2026-11-07" in device time. Used to group events by day. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * The month as weeks of seven cells, Sunday first. Cells outside the month are null, so
 * every week lines up under the weekday headers.
 */
export function monthGrid({ year, month }: Month): (Date | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Events grouped by day key, each day in start-time order. */
export function eventsByDay(events: EventSummary[]): Map<string, EventSummary[]> {
  const byDay = new Map<string, EventSummary[]>();
  const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const event of sorted) {
    const key = dayKey(event.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  return byDay;
}

/**
 * Which day to select when a month opens: today if it's in that month, otherwise the
 * first day with an event, otherwise the 1st.
 */
export function defaultDay(month: Month, today: Date, byDay: Map<string, EventSummary[]>): Date {
  if (today.getFullYear() === month.year && today.getMonth() === month.month) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }
  const first = [...byDay.values()][0]?.[0];
  if (first) {
    const d = first.startsAt;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return new Date(month.year, month.month, 1);
}

/** "Saturday, November 7" for the selected day's heading. */
export function longDay(date: Date): string {
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    date.getDay()
  ];
  return `${weekday}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}
