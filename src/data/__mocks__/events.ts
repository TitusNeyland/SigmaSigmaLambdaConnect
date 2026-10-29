/**
 * Test double for src/data/events.ts. Use with `jest.mock('@/data/events')`, then set the
 * events with `resetEventsMock`.
 */
import type { EventSummary } from '../events';

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

export function resetEventsMock(initial: EventSummary[] = []) {
  events = initial;
  failing = false;
  fetchUpcomingEvents.mockClear();
}
