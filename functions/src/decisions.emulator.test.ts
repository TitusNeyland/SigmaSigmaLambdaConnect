import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { logMembershipDecision } from './decisions';

// Runs against the Firestore emulator (npm run test:rules).

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'decisions-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('decisions'));
});

describe('logMembershipDecision', () => {
  const after = {
    displayName: 'Sample Pete',
    status: 'approved',
    reviewedBy: 'olivia',
    reviewedAt: Timestamp.fromMillis(5000),
  };

  it('writes one entry per decision, even if the trigger retries', async () => {
    expect(await logMembershipDecision(db, 'evt-1', 'pete', { status: 'pending' }, after)).toBe(
      true,
    );
    await logMembershipDecision(db, 'evt-1', 'pete', { status: 'pending' }, after);
    const all = await db.collection('decisions').get();
    expect(all.size).toBe(1);
    expect(all.docs[0].data()).toMatchObject({
      kind: 'membership',
      subjectId: 'pete',
      decision: 'approved',
      by: 'olivia',
    });
  });

  it('writes nothing for an ordinary profile edit', async () => {
    expect(await logMembershipDecision(db, 'evt-2', 'pete', after, { ...after, bio: 'x' })).toBe(
      false,
    );
    expect((await db.collection('decisions').get()).size).toBe(0);
  });
});
