import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { sendPush, type PushDeps, type PushMessage } from './push.js';

/**
 * Times in notifications are shown in the chapter's time zone, since Cloud Functions run in
 * UTC. Change this if the chapter isn't on Central time.
 */
export const CHAPTER_TIME_ZONE = 'America/Chicago';

const HOUR = 3600_000;
/** Reminders go out about a day ahead; the job runs hourly, so each event is caught once. */
export const REMINDER_WINDOW_MS = 24 * HOUR;

type EventData = {
  title?: unknown;
  location?: unknown;
  startsAt?: unknown;
  rsvpDeadline?: unknown;
  cancelled?: unknown;
  createdBy?: unknown;
  reminderSentAt?: unknown;
  deadlineNudgeSentAt?: unknown;
};

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const date = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

/** "Sat, Nov 7 at 7:00 PM" in the chapter's time zone. */
export function formatWhen(when: Date, timeZone = CHAPTER_TIME_ZONE): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(when);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(when);
  return `${day} at ${time}`;
}

export function newEventMessage(id: string, event: EventData): PushMessage | null {
  const title = text(event.title);
  const startsAt = date(event.startsAt);
  if (!title || !startsAt || event.cancelled === true) return null;
  const place = text(event.location);
  return {
    title: `New event: ${title}`,
    body: [formatWhen(startsAt), place].filter(Boolean).join(' · '),
    data: { eventId: id },
  };
}

export function reminderMessage(id: string, event: EventData): PushMessage | null {
  const title = text(event.title);
  const startsAt = date(event.startsAt);
  if (!title || !startsAt) return null;
  const place = text(event.location);
  return {
    title: `Coming up: ${title}`,
    body: [formatWhen(startsAt), place].filter(Boolean).join(' · '),
    data: { eventId: id },
  };
}

export function deadlineNudgeMessage(id: string, event: EventData): PushMessage | null {
  const title = text(event.title);
  const deadline = date(event.rsvpDeadline);
  if (!title || !deadline) return null;
  return {
    title: `RSVP for ${title}`,
    body: `Let the chapter know if you’re coming by ${formatWhen(deadline)}.`,
    data: { eventId: id },
  };
}

async function approvedMemberIds(db: Firestore): Promise<string[]> {
  const snap = await db.collection('members').where('status', '==', 'approved').get();
  return snap.docs.map((d) => d.id);
}

/** Tells every approved member about a new event, except the officer who made it. */
export async function announceNewEvent(id: string, event: EventData, deps: PushDeps = {}) {
  const message = newEventMessage(id, event);
  if (!message) return { sent: 0 };
  const db = deps.db ?? getFirestore();
  const everyone = await approvedMemberIds(db);
  return sendPush(
    everyone.filter((uid) => uid !== event.createdBy),
    'events',
    message,
    deps,
  );
}

/**
 * The hourly job:
 * - reminds Going and Maybe RSVPs about events starting in the next 24 hours;
 * - nudges approved members who haven't answered when the RSVP deadline is within 24 hours.
 * Each event is marked when done, so nobody gets the same notification twice.
 */
export async function runEventNotifications(now: Date, deps: PushDeps = {}) {
  const db = deps.db ?? getFirestore();
  const from = Timestamp.fromDate(now);
  const to = Timestamp.fromMillis(now.getTime() + REMINDER_WINDOW_MS);
  let reminders = 0;
  let nudges = 0;

  const starting = await db
    .collection('events')
    .where('startsAt', '>', from)
    .where('startsAt', '<=', to)
    .get();
  for (const doc of starting.docs) {
    const event = doc.data() as EventData;
    if (event.cancelled === true || event.reminderSentAt) continue;
    const message = reminderMessage(doc.id, event);
    if (!message) continue;
    const rsvps = await doc.ref.collection('rsvps').where('status', 'in', ['going', 'maybe']).get();
    // Mark first: a crash after this skips one reminder rather than sending it twice.
    await doc.ref.update({ reminderSentAt: Timestamp.fromDate(now) });
    await sendPush(
      rsvps.docs.map((r) => r.id),
      'events',
      message,
      deps,
    );
    reminders++;
  }

  const closing = await db
    .collection('events')
    .where('rsvpDeadline', '>', from)
    .where('rsvpDeadline', '<=', to)
    .get();
  let everyone: string[] | null = null;
  for (const doc of closing.docs) {
    const event = doc.data() as EventData;
    if (event.cancelled === true || event.deadlineNudgeSentAt) continue;
    const message = deadlineNudgeMessage(doc.id, event);
    if (!message) continue;
    everyone ??= await approvedMemberIds(db);
    const answered = new Set((await doc.ref.collection('rsvps').get()).docs.map((r) => r.id));
    await doc.ref.update({ deadlineNudgeSentAt: Timestamp.fromDate(now) });
    await sendPush(
      everyone.filter((uid) => !answered.has(uid)),
      'events',
      message,
      deps,
    );
    nudges++;
  }

  return { reminders, nudges };
}

export const notifyNewEvent = onDocumentCreated('events/{eventId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await announceNewEvent(event.params.eventId, data as EventData);
});

export const eventNotifications = onSchedule(
  { schedule: 'every 60 minutes', timeZone: CHAPTER_TIME_ZONE },
  async () => {
    const result = await runEventNotifications(new Date());
    logger.info('Event notifications', result);
  },
);
