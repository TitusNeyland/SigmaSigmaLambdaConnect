import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { fetchDirectory } from './directory';
import { db, functions } from './firebase';
import type { RsvpStatus } from './types';

const DAY = 86_400_000;
/** Events officers can take attendance for: the last two weeks through tomorrow. */
export const LOOK_BACK_DAYS = 14;
export const LOOK_AHEAD_DAYS = 1;

export type AttendanceEvent = { id: string; title: string; startsAt: Date; location: string };

export type RosterEntry = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  rsvp: RsvpStatus | null;
  checkedIn: boolean;
  /** Hours saved on their check-in, if any. */
  serviceHours: number | null;
};

export type Roster = { event: AttendanceEvent; members: RosterEntry[] };

function toEvent(id: string, data: Record<string, unknown>): AttendanceEvent | null {
  if (typeof data.title !== 'string' || !(data.startsAt instanceof Timestamp)) return null;
  return {
    id,
    title: data.title,
    startsAt: data.startsAt.toDate(),
    location: typeof data.location === 'string' ? data.location : '',
  };
}

/** Recent and upcoming events to check people in at, newest first. Cancelled ones are left out. */
export async function fetchAttendanceEvents(now = new Date()): Promise<AttendanceEvent[]> {
  const snap = await getDocs(
    query(
      collection(db, 'events'),
      where('startsAt', '>=', Timestamp.fromMillis(now.getTime() - LOOK_BACK_DAYS * DAY)),
      where('startsAt', '<=', Timestamp.fromMillis(now.getTime() + LOOK_AHEAD_DAYS * DAY)),
      orderBy('startsAt', 'desc'),
    ),
  );
  return snap.docs
    .filter((d) => d.get('cancelled') !== true)
    .map((d) => toEvent(d.id, d.data()))
    .filter((e): e is AttendanceEvent => e !== null);
}

/** Everyone approved, with their RSVP and whether they're already checked in. Officers only. */
export async function fetchRoster(eventId: string): Promise<Roster | null> {
  const ref = doc(db, 'events', eventId);
  const [eventSnap, members, rsvps, attendance] = await Promise.all([
    getDoc(ref),
    fetchDirectory(),
    getDocs(collection(ref, 'rsvps')),
    getDocs(collection(ref, 'attendance')),
  ]);
  const event = eventSnap.exists() ? toEvent(eventSnap.id, eventSnap.data()) : null;
  if (!event) return null;
  const rsvpBy = new Map(rsvps.docs.map((d) => [d.id, d.get('status') as RsvpStatus]));
  const hereBy = new Map(attendance.docs.map((d) => [d.id, d.get('serviceHours') as unknown]));
  return {
    event,
    members: members
      .map((m) => {
        const hours = hereBy.get(m.uid);
        return {
          uid: m.uid,
          displayName: m.displayName,
          photoURL: m.photoURL,
          rsvp: rsvpBy.get(m.uid) ?? null,
          checkedIn: hereBy.has(m.uid),
          serviceHours: typeof hours === 'number' ? hours : null,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

export type AttendanceChanges = {
  /** Check in, or re-save to update hours. */
  checkIn: { uid: string; walkIn: boolean }[];
  /** Undo a saved check-in. */
  remove: string[];
  /** Hours for everyone in checkIn, or null to log none. */
  serviceHours: number | null;
};

const BATCH = 400;

/** Saves check-ins in the shape the rules require, then asks for the KPIs to refresh. */
export async function saveAttendance(
  eventId: string,
  officerUid: string,
  changes: AttendanceChanges,
): Promise<void> {
  const writes = [
    ...changes.checkIn.map(
      (c) => (batch: ReturnType<typeof writeBatch>) =>
        batch.set(doc(db, 'events', eventId, 'attendance', c.uid), {
          memberId: c.uid,
          checkedInBy: officerUid,
          checkedInAt: serverTimestamp(),
          walkIn: c.walkIn,
          ...(changes.serviceHours === null ? {} : { serviceHours: changes.serviceHours }),
        }),
    ),
    ...changes.remove.map(
      (uid) => (batch: ReturnType<typeof writeBatch>) =>
        batch.delete(doc(db, 'events', eventId, 'attendance', uid)),
    ),
  ];
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + BATCH)) w(batch);
    await batch.commit();
  }
  // Best effort: the hourly job catches up if this fails.
  await httpsCallable(functions, 'refreshKpis')().catch(() => undefined);
}
