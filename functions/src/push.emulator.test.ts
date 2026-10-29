import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXPO_PUSH_URL, sendPush } from './push';

// Runs against the Firestore emulator (npm run test:rules). Expo's API is faked.

const PROJECT_ID = 'demo-ssl-rules';
let app: App;
let db: Firestore;

type Sent = { to: string; title: string; body: string; data: Record<string, string> };

function fakeExpo(errors: Record<string, string> = {}) {
  const requests: Sent[][] = [];
  const fetchImpl = vi.fn(async (url: string, init: { body: string }) => {
    expect(url).toBe(EXPO_PUSH_URL);
    const messages = JSON.parse(init.body) as Sent[];
    requests.push(messages);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: messages.map((m) =>
          errors[m.to] ? { status: 'error', details: { error: errors[m.to] } } : { status: 'ok' },
        ),
      }),
    };
  });
  return {
    fetchImpl,
    requests,
    sentTo: () =>
      requests
        .flat()
        .map((m) => m.to)
        .sort(),
  };
}

async function member(uid: string, status: string, prefs?: Record<string, boolean>) {
  await db.doc(`members/${uid}`).set({
    displayName: uid,
    initiationTerm: 'Fall 2020',
    status,
    ...(prefs ? { notificationPrefs: prefs } : {}),
  });
}

async function phone(uid: string, token: string) {
  await db.doc(`pushTokens/${uid}/tokens/${token.replace(/\W/g, '_')}`).set({
    token,
    platform: 'ios',
  });
}

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'push-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('members'));
  await db.recursiveDelete(db.collection('pushTokens'));
  await member('alice', 'approved');
  await member('quiet', 'approved', { events: false });
  await member('pete', 'pending');
  await phone('alice', 'ExponentPushToken[alice-phone]');
  await phone('alice', 'ExponentPushToken[alice-ipad]');
  await phone('quiet', 'ExponentPushToken[quiet]');
  await phone('pete', 'ExponentPushToken[pete]');
});

describe('sendPush', () => {
  const message = { title: 'Reminder', body: 'Meeting at 7', data: { eventId: 'e1' } };

  it('sends to every phone of members who want it, and skips the rest', async () => {
    const expo = fakeExpo();
    const result = await sendPush(['alice', 'quiet', 'pete', 'ghost'], 'events', message, {
      db,
      fetchImpl: expo.fetchImpl,
    });
    expect(expo.sentTo()).toEqual([
      'ExponentPushToken[alice-ipad]',
      'ExponentPushToken[alice-phone]',
    ]);
    expect(result).toEqual({ sent: 2, skippedMembers: 3 });
    expect(expo.requests[0][0]).toMatchObject({ title: 'Reminder', data: { eventId: 'e1' } });
  });

  it('sends account notices to pending members and ignores the switches', async () => {
    const expo = fakeExpo();
    await sendPush(['pete', 'quiet'], 'account', message, { db, fetchImpl: expo.fetchImpl });
    expect(expo.sentTo()).toEqual(['ExponentPushToken[pete]', 'ExponentPushToken[quiet]']);
  });

  it('removes phones Expo says no longer have the app', async () => {
    const expo = fakeExpo({ 'ExponentPushToken[alice-ipad]': 'DeviceNotRegistered' });
    const result = await sendPush(['alice'], 'events', message, {
      db,
      fetchImpl: expo.fetchImpl,
    });
    expect(result.sent).toBe(1);
    const left = await db.collection('pushTokens/alice/tokens').get();
    expect(left.docs.map((d) => d.get('token'))).toEqual(['ExponentPushToken[alice-phone]']);
  });

  it('sends nothing for nobody, and survives Expo being down', async () => {
    const expo = fakeExpo();
    expect(await sendPush([], 'events', message, { db, fetchImpl: expo.fetchImpl })).toEqual({
      sent: 0,
      skippedMembers: 0,
    });
    expect(expo.fetchImpl).not.toHaveBeenCalled();

    const down = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(await sendPush(['alice'], 'events', message, { db, fetchImpl: down })).toEqual({
      sent: 0,
      skippedMembers: 0,
    });
    expect((await db.collection('pushTokens/alice/tokens').get()).size).toBe(2);
  });
});
