/**
 * Test double for src/data/events.ts. Use with `jest.mock('@/data/events')`, then set the
 * events with `resetEventsMock`.
 */
import type { EventDetail, EventSummary } from '../events';
import type { RsvpStatus } from '../types';

let events: EventSummary[] = [];
let failing = false;

export function sampleEvent(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: 'sample-meeting',
    title: 'Sample chapter meeting',
    category: 'meeting',
    description: 'Sample monthly meeting.',
    startsAt: new Date(Date.now() + 2 * 86_400_000),
    endsAt: null,
    location: 'Chapter house',
    photoURL: null,
    cancelled: false,
    myRsvp: null,
    ...overrides,
  };
}

export function setMockEvents(next: EventSummary[]) {
  events = next;
}

/** Makes the next load fail, like a network error. */
export function failEventsLoad() {
  failing = true;
}

export const fetchUpcomingEvents = jest.fn(async (_uid: string, _now?: Date) => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  return events;
});

/** Every mock event starting in [from, to), like the real range query. */
export const fetchEventsBetween = jest.fn(async (_uid: string, from: Date, to: Date) => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  return events.filter((e) => e.startsAt >= from && e.startsAt < to);
});

let details: Record<string, EventDetail | null> = {};

export function sampleDetail(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    ...sampleEvent(),
    address: '100 Sample St',
    feeCents: 0,
    rsvpDeadline: new Date(Date.now() + 86_400_000),
    host: { uid: 'sample-jordan', displayName: 'Jordan Hill', photoURL: null },
    going: { count: 0, preview: [] },
    ...overrides,
  };
}

/** Details by event ID. An ID that isn't listed is treated as deleted. */
export function setMockDetails(next: Record<string, EventDetail | null>) {
  details = next;
}

export const fetchEventDetail = jest.fn(async (id: string, _uid: string) => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  return details[id] ?? null;
});

export class RsvpSaveError extends Error {
  constructor(readonly reason: 'closed' | 'failed') {
    super(reason);
  }
}

/** Saves into the mock detail so a reload shows the new RSVP and going count. */
export const setRsvp = jest.fn(async (eventId: string, _uid: string, status: RsvpStatus) => {
  const detail = details[eventId];
  if (!detail) return;
  const wasGoing = detail.myRsvp === 'going';
  const isGoing = status === 'going';
  details[eventId] = {
    ...detail,
    myRsvp: status,
    going: { ...detail.going, count: detail.going.count + (isGoing ? 1 : 0) - (wasGoing ? 1 : 0) },
  };
});

export function resetEventsMock(initial: EventSummary[] = []) {
  events = initial;
  failing = false;
  fetchUpcomingEvents.mockClear();
  fetchEventsBetween.mockClear();
  details = {};
  fetchEventDetail.mockClear();
  setRsvp.mockClear();
}
