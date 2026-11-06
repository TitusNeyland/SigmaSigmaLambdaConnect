import type { DirectoryEntry } from '@/data/directory';

/** A brother whose line anniversary falls in the coming week. */
export type Anniversary = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  /** This year's anniversary (or next year's, if it's already passed this year). */
  date: Date;
  /** Years since he crossed, on that day. */
  years: number;
};

/** How many days ahead Home looks, counting today. */
export const ANNIVERSARY_DAYS = 7;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The anniversary of `crossed` in year `y`. Feb 29 falls on Feb 28 in other years. */
export function inYear(crossed: Date, y: number): Date {
  const day = crossed.getMonth() === 1 && crossed.getDate() === 29 && !isLeap(y) ? 28 : null;
  return new Date(y, crossed.getMonth(), day ?? crossed.getDate());
}

/**
 * Brothers whose line anniversary is today or in the next six days, soonest first. Only
 * those who added an initiation date, and at least one year after they crossed.
 */
export function anniversariesThisWeek(
  members: Pick<DirectoryEntry, 'uid' | 'displayName' | 'photoURL' | 'initiationDate'>[],
  now: Date,
  days = ANNIVERSARY_DAYS,
): Anniversary[] {
  const today = startOfDay(now);
  const until = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const found: Anniversary[] = [];
  for (const m of members) {
    if (!m.initiationDate) continue;
    let date = inYear(m.initiationDate, today.getFullYear());
    if (date < today) date = inYear(m.initiationDate, today.getFullYear() + 1);
    if (date >= until) continue;
    const years = date.getFullYear() - m.initiationDate.getFullYear();
    if (years < 1) continue;
    found.push({ uid: m.uid, displayName: m.displayName, photoURL: m.photoURL, date, years });
  }
  return found.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.displayName.localeCompare(b.displayName),
  );
}

export const yearsLabel = (n: number) => (n === 1 ? '1 year' : `${n} years`);
