import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MEMBERS, POSTS } from '../../tools/seed/data';
import { buildSeedDocs, writeSeed } from '../../tools/seed/seed';
import { createTestEnv, PROJECT_ID } from '../rules/helpers';

// Writes the seed into the Firestore emulator with the Admin SDK, then checks that sample
// people can actually use it under the real security rules.

let env: RulesTestEnvironment;
let adminApp: App;
let admin: AdminFirestore;

const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await createTestEnv();
  adminApp = initializeApp({ projectId: PROJECT_ID }, 'seed-test');
  admin = getFirestore(adminApp);
});

afterAll(async () => {
  await deleteApp(adminApp);
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('seeding the emulator', () => {
  it('writes every document', async () => {
    const docs = buildSeedDocs();
    expect(await writeSeed(admin, docs)).toBe(docs.length);
    const members = await admin.collection('members').get();
    expect(members.size).toBe(MEMBERS.length);
  });

  it('can run twice without duplicating anything', async () => {
    await writeSeed(admin, buildSeedDocs());
    await writeSeed(admin, buildSeedDocs());
    expect((await admin.collection('members').get()).size).toBe(MEMBERS.length);
    expect((await admin.collection('posts').get()).size).toBe(POSTS.length);
  });
});

describe('seeded data works with the security rules', () => {
  beforeEach(async () => {
    await writeSeed(admin, buildSeedDocs());
  });

  it('an approved sample member can read the feed, events and programs', async () => {
    const db = as('sample-marcus');
    await assertSucceeds(getDocs(collection(db, 'events')));
    await assertSucceeds(getDoc(doc(db, 'posts/sample-post-food-bank')));
    await assertSucceeds(getDocs(collection(db, 'programs/sample-scholarship/milestones')));
    await assertSucceeds(getDocs(collection(db, 'announcements')));
  });

  it('a pending sample member sees nothing but their own profile', async () => {
    const db = as('sample-isaiah');
    await assertSucceeds(getDoc(doc(db, 'members/sample-isaiah')));
    await assertFails(getDoc(doc(db, 'events/sample-service-day')));
    await assertFails(getDoc(doc(db, 'members/sample-marcus')));
  });

  it('sample officers can approve the pending members', async () => {
    await assertSucceeds(
      updateDoc(doc(as('sample-jordan'), 'members/sample-isaiah'), {
        status: 'approved',
        reviewedBy: 'sample-jordan',
        reviewedAt: serverTimestamp(),
      }),
    );
  });

  it('sample members can edit their seeded profile, so the seed passes profile validation', async () => {
    for (const m of MEMBERS) {
      await assertSucceeds(
        updateDoc(doc(as(m.uid), `members/${m.uid}`), { headline: `${m.headline} (edited)` }),
      );
    }
  });

  it('sample members can RSVP to the upcoming sample events', async () => {
    await assertSucceeds(
      setDoc(doc(as('sample-brandon'), 'events/sample-service-day/rsvps/sample-brandon'), {
        memberId: 'sample-brandon',
        status: 'going',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('RSVPs to the past sample meeting are locked', async () => {
    await assertFails(
      setDoc(doc(as('sample-brandon'), 'events/sample-meeting-past/rsvps/sample-brandon'), {
        memberId: 'sample-brandon',
        status: 'going',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('a member who has not accepted the guidelines cannot post yet', async () => {
    const elijah = MEMBERS.find((m) => m.uid === 'sample-elijah')!;
    expect(elijah.guidelinesAccepted).toBe(false);
    await assertFails(
      setDoc(doc(as('sample-elijah'), 'posts/new'), {
        authorId: 'sample-elijah',
        caption: 'Hi',
        photoPaths: [],
        allowComments: true,
        official: false,
        removed: false,
        likeCount: 0,
        commentCount: 0,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('only the sample officers can see KPIs and reports', async () => {
    await assertFails(getDocs(collection(as('sample-marcus'), 'reports')));
    await assertSucceeds(getDocs(collection(as('sample-kevin'), 'reports')));
  });
});
