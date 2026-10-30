import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { announce, announcementMessage } from './announcements';

// Runs against the Firestore emulator (npm run test:rules). Expo's API is faked.

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'announcements-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'pushTokens']) await db.recursiveDelete(db.collection(c));
  const people: [string, string, Record<string, boolean>?][] = [
    ['olivia', 'approved'],
    ['alice', 'approved'],
    ['quiet', 'approved', { announcements: false }],
    ['pete', 'pending'],
  ];
  for (const [uid, status, prefs] of people) {
    await db.doc(`members/${uid}`).set({
      displayName: uid,
      initiationTerm: 'Fall 2020',
      status,
      ...(prefs ? { notificationPrefs: prefs } : {}),
    });
    await db.doc(`pushTokens/${uid}/tokens/t`).set({ token: `ExponentPushToken[${uid}]` });
  }
});

describe('announce', () => {
  it('pushes to approved members who want announcements, not the author', async () => {
    const sent: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
      const messages = JSON.parse(init.body) as { to: string }[];
      sent.push(...messages.map((m) => m.to));
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: messages.map(() => ({ status: 'ok' })) }),
      };
    });
    await announce(
      'a1',
      {
        title: 'Dues reminder',
        body: 'Pay by Friday',
        authorTitle: 'Treasurer',
        authorId: 'olivia',
      },
      { db, fetchImpl },
    );
    expect(sent).toEqual(['ExponentPushToken[alice]']);
  });

  it('builds the message from the announcement', () => {
    expect(
      announcementMessage('a1', {
        title: ' Dues ',
        body: 'Pay by Friday',
        authorTitle: 'Treasurer',
      }),
    ).toEqual({
      title: 'Dues',
      body: 'Treasurer: Pay by Friday',
      data: { announcementId: 'a1', screen: 'chapter' },
    });
    expect(announcementMessage('a1', { title: '' })).toBeNull();
  });
});
