import type { AttendanceChanges, RosterEntry } from '@/data/attendance';

export type RosterFilter = 'rsvpd' | 'all';

/** Said they're coming (going or maybe). Anyone else checked in is a walk-in. */
export const isRsvpd = (m: RosterEntry) => m.rsvp === 'going' || m.rsvp === 'maybe';

/**
 * Who to list. RSVP'd shows people who said going or maybe, plus anyone already checked in
 * so walk-ins don't vanish. Search matches any part of the name.
 */
export function visibleRoster(
  members: RosterEntry[],
  checked: ReadonlySet<string>,
  filter: RosterFilter,
  search: string,
): RosterEntry[] {
  const q = search.trim().toLowerCase();
  return members.filter(
    (m) =>
      (filter === 'all' || isRsvpd(m) || checked.has(m.uid)) &&
      (!q || m.displayName.toLowerCase().includes(q)),
  );
}

/** "12 of 18 going checked in", and the bar's percent. */
export function checkInSummary(
  members: RosterEntry[],
  checked: ReadonlySet<string>,
): { checkedIn: number; going: number; percent: number; line: string } {
  const going = members.filter((m) => m.rsvp === 'going').length;
  const checkedIn = members.filter((m) => checked.has(m.uid)).length;
  const percent = going ? Math.min(100, Math.round((checkedIn / going) * 100)) : 0;
  return {
    checkedIn,
    going,
    percent,
    line: `${checkedIn} checked in · ${going} RSVP’d going`,
  };
}

/** Hours typed by the officer: more than 0, at most 24 (the rules' limit), halves allowed. */
export function parseHours(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!(n > 0 && n <= 24)) return null;
  return Math.round(n * 2) / 2;
}

/** The hours already saved for this event, so the switch starts the way it was left. */
export function savedHours(members: RosterEntry[]): number | null {
  return members.find((m) => m.checkedIn && m.serviceHours !== null)?.serviceHours ?? null;
}

/** What to write: new check-ins, check-ins whose hours change, and check-ins to undo. */
export function attendanceChanges(
  members: RosterEntry[],
  checked: ReadonlySet<string>,
  hours: number | null,
): AttendanceChanges {
  const checkIn: AttendanceChanges['checkIn'] = [];
  const remove: string[] = [];
  for (const m of members) {
    const now = checked.has(m.uid);
    if (m.checkedIn && !now) remove.push(m.uid);
    else if (now && (!m.checkedIn || (hours !== null && m.serviceHours !== hours))) {
      checkIn.push({ uid: m.uid, walkIn: !isRsvpd(m) });
    }
  }
  return { checkIn, remove, serviceHours: hours };
}

export const hasChanges = (c: AttendanceChanges) => c.checkIn.length > 0 || c.remove.length > 0;

/** "Saved. 14 checked in, 28 service hours logged." */
export function savedMessage(checkedIn: number, hours: number | null): string {
  const people = `${checkedIn} checked in`;
  if (hours === null || checkedIn === 0) return `Saved. ${people}.`;
  const total = Math.round(checkedIn * hours * 10) / 10;
  return `Saved. ${people}, ${total} service ${total === 1 ? 'hour' : 'hours'} logged.`;
}
