/** Test double for src/data/attendance.ts. Use with `jest.mock('@/data/attendance')`. */
import type { AttendanceChanges, AttendanceEvent, Roster, RosterEntry } from '../attendance';

let events: AttendanceEvent[] = [];
let roster: Roster | null = null;
let failingEvents = false;
let failingRoster = false;
let failingSave = false;

export function sampleAttendanceEvent(overrides: Partial<AttendanceEvent> = {}): AttendanceEvent {
  return {
    id: 'sample-meeting',
    title: 'Sample chapter meeting',
    startsAt: new Date(Date.now() - 3600_000),
    location: 'Sample hall',
    ...overrides,
  };
}

export function sampleEntry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    uid: 'sample-marcus',
    displayName: 'Sample Marcus',
    photoURL: null,
    rsvp: 'going',
    checkedIn: false,
    serviceHours: null,
    ...overrides,
  };
}

export function setMockAttendanceEvents(next: AttendanceEvent[]) {
  events = next;
}
export function setMockRoster(next: Roster | null) {
  roster = next;
}
export function failAttendanceEventsLoad() {
  failingEvents = true;
}
export function failRosterLoad() {
  failingRoster = true;
}
export function failNextAttendanceSave() {
  failingSave = true;
}

export const fetchAttendanceEvents = jest.fn(async (_now?: Date) => {
  if (failingEvents) {
    failingEvents = false;
    throw new Error('offline');
  }
  return events;
});

export const fetchRoster = jest.fn(async (_eventId: string) => {
  if (failingRoster) {
    failingRoster = false;
    throw new Error('offline');
  }
  return roster;
});

export const saveAttendance = jest.fn(
  async (_eventId: string, _officer: string, _changes: AttendanceChanges) => {
    if (failingSave) {
      failingSave = false;
      throw new Error('offline');
    }
  },
);

export function resetAttendanceMock() {
  events = [];
  roster = null;
  failingEvents = false;
  failingRoster = false;
  failingSave = false;
  fetchAttendanceEvents.mockClear();
  fetchRoster.mockClear();
  saveAttendance.mockClear();
}
