import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import { EVENT_CATEGORIES, type EventCategory, type RsvpStatus } from './types';

export { EVENT_CATEGORIES };

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

/** A chapter's calendar is small, so one page covers any range we ask for. */
const MAX_EVENTS = 100;

async function fetchEvents(uid: string, from: Date, to: Date | null): Promise<EventSummary[]> {
  const snap = await getDocs(
    query(
      collection(db, 'events'),
      where('startsAt', '>=', Timestamp.fromDate(from)),
      ...(to ? [where('startsAt', '<', Timestamp.fromDate(to))] : []),
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
  return events.filter((e): e is EventSummary => e !== null);
}

/**
 * Events that haven't ended yet, soonest first, each with the member's RSVP. An event that
 * started earlier today stays listed until it's over (or for 3 hours if it has no end time).
 */
export async function fetchUpcomingEvents(uid: string, now = new Date()): Promise<EventSummary[]> {
  const events = await fetchEvents(uid, new Date(now.getTime() - 24 * 3600_000), null);
  return events.filter((e) => {
    const end = e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3600_000);
    return end.getTime() > now.getTime();
  });
}

/** Every event starting in [from, to), past ones included, for the calendar (#21). */
export function fetchEventsBetween(uid: string, from: Date, to: Date): Promise<EventSummary[]> {
  return fetchEvents(uid, from, to);
}

/** Someone shown in the "who's going" summary. */
export type Attendee = { uid: string; displayName: string; photoURL: string | null };

/** Everything the event detail screen shows (#22). */
export type EventDetail = EventSummary & {
  address: string;
  feeCents: number;
  rsvpDeadline: Date | null;
  host: Attendee | null;
  going: { count: number; preview: Attendee[] };
};

/** How many going brothers the detail screen shows by name or photo. */
const GOING_PREVIEW = 5;

async function member(uid: string): Promise<Attendee | null> {
  const snap = await getDoc(doc(db, 'members', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const displayName = text(data.displayName).trim();
  if (!displayName) return null;
  return {
    uid,
    displayName,
    photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
  };
}

/**
 * One event with its host, the member's RSVP and a summary of who's going. Null if the
 * event doesn't exist. Hosts or attendees whose profiles are gone are left out.
 */
export async function fetchEventDetail(eventId: string, uid: string): Promise<EventDetail | null> {
  const eventRef = doc(db, 'events', eventId);
  const goingQuery = query(collection(eventRef, 'rsvps'), where('status', '==', 'going'));
  const [eventSnap, mine, goingCount, goingSnap] = await Promise.all([
    getDoc(eventRef),
    getDoc(doc(eventRef, 'rsvps', uid)),
    getAggregateFromServer(goingQuery, { count: count() }),
    getDocs(query(goingQuery, limit(GOING_PREVIEW))),
  ]);
  if (!eventSnap.exists()) return null;
  const data = eventSnap.data();
  const status = mine.exists() ? (mine.data().status as RsvpStatus) : null;
  const summary = toEventSummary(eventId, data, status && RSVPS.includes(status) ? status : null);
  if (!summary) return null;

  const hostId = text(data.createdBy);
  const [host, ...preview] = await Promise.all([
    hostId ? member(hostId) : Promise.resolve(null),
    ...goingSnap.docs.map((d) => member(d.id)),
  ]);
  return {
    ...summary,
    address: text(data.address),
    feeCents: typeof data.feeCents === 'number' && data.feeCents > 0 ? data.feeCents : 0,
    rsvpDeadline: toDate(data.rsvpDeadline),
    host,
    going: {
      count: goingCount.data().count,
      preview: preview.filter((a): a is Attendee => a !== null),
    },
  };
}

export type RsvpError = 'closed' | 'failed';

/** Why an RSVP couldn't be saved: closed means the deadline passed or the event was cancelled. */
export class RsvpSaveError extends Error {
  constructor(readonly reason: RsvpError) {
    super(reason === 'closed' ? 'RSVPs are closed.' : 'Couldn’t save your RSVP.');
  }
}

/**
 * Saves the member's RSVP. This is intent only: attendance is a separate officer check-in
 * (#49) and is what participation metrics count. The rules reject changes after the
 * deadline or on a cancelled event.
 */
export async function setRsvp(eventId: string, uid: string, status: RsvpStatus): Promise<void> {
  try {
    await setDoc(doc(db, 'events', eventId, 'rsvps', uid), {
      memberId: uid,
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    throw new RsvpSaveError(code === 'permission-denied' ? 'closed' : 'failed');
  }
}

/** One event with the member's RSVP, for the card on an official post (#39). */
export async function fetchEventSummary(
  eventId: string,
  uid: string,
): Promise<EventSummary | null> {
  const [snap, mine] = await Promise.all([
    getDoc(doc(db, 'events', eventId)),
    getDoc(doc(db, 'events', eventId, 'rsvps', uid)),
  ]);
  if (!snap.exists()) return null;
  const status = mine.exists() ? (mine.data().status as RsvpStatus) : null;
  return toEventSummary(eventId, snap.data(), status && RSVPS.includes(status) ? status : null);
}
