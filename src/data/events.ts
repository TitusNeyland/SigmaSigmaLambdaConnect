import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import type { EventCategory, RsvpStatus } from './types';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'meeting',
  'service',
  'learning',
  'brotherhood',
  'fundraiser',
  'social',
  'public',
];

/** An event as the Events tab shows it, with the signed-in member's own RSVP. */
export type EventSummary = {
  id: string;
  title: string;
  category: EventCategory;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  photoURL: string | null;
  cancelled: boolean;
  /** Null when the member hasn't RSVPed. */
  myRsvp: RsvpStatus | null;
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const toDate = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);
const RSVPS: readonly RsvpStatus[] = ['going', 'maybe', 'not_going'];

/** Maps an event document, or null if it's missing what the list needs. */
export function toEventSummary(
  id: string,
  data: Record<string, unknown>,
  myRsvp: RsvpStatus | null,
): EventSummary | null {
  const startsAt = toDate(data.startsAt);
  const title = text(data.title).trim();
  if (!startsAt || !title) return null;
  return {
    id,
    title,
    category: EVENT_CATEGORIES.includes(data.category as EventCategory)
      ? (data.category as EventCategory)
      : 'meeting',
    description: text(data.description),
    startsAt,
    endsAt: toDate(data.endsAt),
    location: text(data.location),
    photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
    cancelled: data.cancelled === true,
    myRsvp,
  };
}

/** A chapter's upcoming calendar is small, so one page covers it. */
const MAX_EVENTS = 100;

/**
 * Events that haven't ended yet, soonest first, each with the member's RSVP. An event that
 * started earlier today stays listed until it's over (or for 3 hours if it has no end time).
 */
export async function fetchUpcomingEvents(uid: string, now = new Date()): Promise<EventSummary[]> {
  const since = Timestamp.fromMillis(now.getTime() - 24 * 3600_000);
  const snap = await getDocs(
    query(
      collection(db, 'events'),
      where('startsAt', '>=', since),
      orderBy('startsAt', 'asc'),
      limit(MAX_EVENTS),
    ),
  );
  const events = await Promise.all(
    snap.docs.map(async (d) => {
      const rsvp = await getDoc(doc(db, 'events', d.id, 'rsvps', uid));
      const status = rsvp.exists() ? (rsvp.data().status as RsvpStatus) : null;
      return toEventSummary(d.id, d.data(), status && RSVPS.includes(status) ? status : null);
    }),
  );
  return events.filter((e): e is EventSummary => {
    if (!e) return false;
    const end = e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3600_000);
    return end.getTime() > now.getTime();
  });
}
