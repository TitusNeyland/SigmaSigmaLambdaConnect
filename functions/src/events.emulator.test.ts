import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { announceNewEvent, runEventNotifications } from './events';

// Runs against the Firestore emulator (npm run test:rules). Expo's API is faked.

const PROJECT_ID = 'demo-ssl-rules';
const NOW = new Date('2026-10-29T17:00:00Z');
const HOUR = 3600_000;
const at = (hours: number) => Timestamp.fromMillis(NOW.getTime() + hours * HOUR);

let app: App;
let db: Firestore;

function fakeExpo() {
  const sent: { to: string; title: string }[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
    const messages = JSON.parse(init.body) as { to: string; title: string }[];
    sent.push(...messages);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: messages.map(() => ({ status: 'ok' })) }),
    };
  });
  const to = (title: string) =>
    sent
      .filter((m) => m.title === title)
      .map((m) => m.to.replace(/^ExponentPushToken\[|\]$/g, ''))
      .sort();
  return { fetchImpl, sent, to };
}

async function member(uid: string, status = 'approved', prefs?: Record<string, boolean>) {
  await db.doc(`members/${uid}`).set({
    displayName: uid,
    initiationTerm: 'Fall 2020',
    status,
    ...(prefs ? { notificationPrefs: prefs } : {}),
  });
  await db.doc(`pushTokens/${uid}/tokens/t`).set({ token: `ExponentPushToken[${uid}]` });
}

async function event(id: string, fields: Record<string, unknown>, rsvps: Record<string, string>) {
  await db.doc(`events/${id}`).set({
    title: id,
    category: 'meeting',
    location: 'Chapter house',
    startsAt: at(72),
    rsvpDeadline: at(48),
    createdBy: 'olivia',
    cancelled: false,
    ...fields,
  });
  for (const [uid, status] of Object.entries(rsvps)) {
    await db.doc(`events/${id}/rsvps/${uid}`).set({ memberId: uid, status });
  }
}

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'events-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'pushTokens', 'events']) await db.recursiveDelete(db.collection(c));
  for (const uid of ['alice', 'bob', 'carl', 'dana', 'olivia']) await member(uid);
  await member('quiet', 'approved', { events: false });
  await member('pete', 'pending');
});

describe('reminders', () => {
  it('reminds Going and Maybe RSVPs about events in the next day, once', async () => {
    await event(
      'tomorrow',
      { startsAt: at(20) },
      { alice: 'going', bob: 'maybe', carl: 'not_going', quiet: 'going' },
    );
    const expo = fakeExpo();
    expect(await runEventNotifications(NOW, { db, fetchImpl: expo.fetchImpl })).toMatchObject({
      reminders: 1,
    });
    expect(expo.to('Coming up: tomorrow')).toEqual(['alice', 'bob']);

    const again = fakeExpo();
    await runEventNotifications(new Date(NOW.getTime() + HOUR), {
      db,
      fetchImpl: again.fetchImpl,
    });
    expect(again.to('Coming up: tomorrow')).toEqual([]);
    expect((await db.doc('events/tomorrow').get()).get('reminderSentAt')).toBeTruthy();
  });

  it('skips cancelled events, past events and ones more than a day out', async () => {
    await event('cancelled', { startsAt: at(5), cancelled: true }, { alice: 'going' });
    await event('past', { startsAt: at(-2) }, { alice: 'going' });
    await event('later', { startsAt: at(30) }, { alice: 'going' });
    const expo = fakeExpo();
    await runEventNotifications(NOW, { db, fetchImpl: expo.fetchImpl });
    expect(expo.sent.filter((m) => m.title.startsWith('Coming up'))).toEqual([]);
  });
});

describe('RSVP deadline nudges', () => {
  it('nudges approved members who haven’t answered, once', async () => {
    await event(
      'gala',
      { rsvpDeadline: at(10), startsAt: at(60) },
      { alice: 'going', bob: 'not_going' },
    );
    const expo = fakeExpo();
    expect(await runEventNotifications(NOW, { db, fetchImpl: expo.fetchImpl })).toMatchObject({
      nudges: 1,
    });
    // Not alice or bob (answered), not quiet (switched off), not pete (pending).
    expect(expo.to('RSVP for gala')).toEqual(['carl', 'dana', 'olivia']);

    const again = fakeExpo();
    await runEventNotifications(new Date(NOW.getTime() + HOUR), {
      db,
      fetchImpl: again.fetchImpl,
    });
    expect(again.to('RSVP for gala')).toEqual([]);
  });

  it('does not nudge for a cancelled event or a deadline that passed', async () => {
    await event('off', { rsvpDeadline: at(5), cancelled: true }, {});
    await event('closed', { rsvpDeadline: at(-1) }, {});
    const expo = fakeExpo();
    expect(await runEventNotifications(NOW, { db, fetchImpl: expo.fetchImpl })).toEqual({
      reminders: 0,
      nudges: 0,
    });
  });
});

describe('new event alerts', () => {
  it('tells every approved member except the officer who made it', async () => {
    const expo = fakeExpo();
    await announceNewEvent(
      'mixer',
      { title: 'Mixer', startsAt: at(100), location: 'Hall', createdBy: 'olivia' },
      { db, fetchImpl: expo.fetchImpl },
    );
    expect(expo.to('New event: Mixer')).toEqual(['alice', 'bob', 'carl', 'dana']);
  });

  it('stays quiet for an event created already cancelled', async () => {
    const expo = fakeExpo();
    await announceNewEvent(
      'x',
      { title: 'X', startsAt: at(5), cancelled: true },
      { db, fetchImpl: expo.fetchImpl },
    );
    expect(expo.fetchImpl).not.toHaveBeenCalled();
  });
});
