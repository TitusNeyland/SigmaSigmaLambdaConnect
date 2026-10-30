import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { helpOfferMessage, notifyHelpOffer } from './programs';

// Runs against the Firestore emulator (npm run test:rules). Expo's API is faked.

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
  return {
    fetchImpl,
    to: () => sent.map((m) => m.to.replace(/^ExponentPushToken\[|\]$/g, '')).sort(),
  };
}

async function member(uid: string, name: string, role?: string) {
  await db
    .doc(`members/${uid}`)
    .set({ displayName: name, initiationTerm: 'Fall 2020', status: 'approved' });
  await db.doc(`pushTokens/${uid}/tokens/t`).set({ token: `ExponentPushToken[${uid}]` });
  if (role) await db.doc(`roles/${uid}`).set({ role });
}

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'programs-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'pushTokens', 'programs', 'roles']) {
    await db.recursiveDelete(db.collection(c));
  }
  await member('chris', 'Chris Baptiste');
  await member('owner', 'Program Owner', 'officer');
  await member('olivia', 'Olivia Officer', 'officer');
  await member('adam', 'Adam Admin', 'admin');
});

describe('notifyHelpOffer', () => {
  it('tells the program’s owner', async () => {
    await db
      .doc('programs/health')
      .set({ name: 'Health Week', ownerId: 'owner', status: 'at_risk' });
    const expo = fakeExpo();
    await notifyHelpOffer('health', 'chris', { db, fetchImpl: expo.fetchImpl });
    expect(expo.to()).toEqual(['owner']);
  });

  it('tells every officer when the program has no owner on file', async () => {
    await db.doc('programs/health').set({ name: 'Health Week', status: 'at_risk' });
    const expo = fakeExpo();
    await notifyHelpOffer('health', 'chris', { db, fetchImpl: expo.fetchImpl });
    expect(expo.to()).toEqual(['adam', 'olivia', 'owner']);
  });

  it('never tells the helper about their own offer, and ignores a deleted program', async () => {
    await db.doc('programs/health').set({ name: 'Health Week', ownerId: 'owner' });
    const expo = fakeExpo();
    await notifyHelpOffer('health', 'owner', { db, fetchImpl: expo.fetchImpl });
    await notifyHelpOffer('gone', 'chris', { db, fetchImpl: expo.fetchImpl });
    expect(expo.to()).toEqual([]);
  });

  it('reads naturally', () => {
    expect(helpOfferMessage('health', 'Chris Baptiste', 'Health Week')).toEqual({
      title: 'Chris Baptiste can help',
      body: 'Chris Baptiste offered to help with Health Week. Reach out to plan next steps.',
      data: { programId: 'health' },
    });
  });
});
