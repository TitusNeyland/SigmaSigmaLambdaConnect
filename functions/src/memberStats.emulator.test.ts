import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { recountAllMemberStats, recountMemberStats } from './memberStats';

// Runs against the Firestore emulator (npm run test:rules).

let app: App;
let db: Firestore;

const checkIn = (eventId: string, uid: string, serviceHours?: unknown) =>
  db.doc(`events/${eventId}/attendance/${uid}`).set({
    memberId: uid,
    checkedInBy: 'olivia',
    checkedInAt: Timestamp.now(),
    ...(serviceHours === undefined ? {} : { serviceHours }),
  });
const stats = async (uid: string) => (await db.doc(`memberStats/${uid}`).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'member-stats-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'events', 'memberStats']) {
    await db.recursiveDelete(db.collection(c));
  }
});

describe('member stats', () => {
  it('counts events checked in at and adds up service hours', async () => {
    await checkIn('e1', 'chris', 4);
    await checkIn('e2', 'chris', 2.5);
    await checkIn('e3', 'chris');
    await checkIn('e4', 'chris', 'lots');
    await checkIn('e1', 'zed', 9);
    expect(await recountMemberStats('chris', db)).toEqual({
      eventsAttended: 4,
      serviceHours: 6.5,
    });
    expect(await stats('chris')).toMatchObject({ eventsAttended: 4, serviceHours: 6.5 });
    expect((await stats('chris'))?.updatedAt).toBeInstanceOf(Timestamp);
  });

  it('goes back to zero when check-ins are removed', async () => {
    await checkIn('e1', 'chris', 4);
    await recountMemberStats('chris', db);
    await db.doc('events/e1/attendance/chris').delete();
    expect(await recountMemberStats('chris', db)).toEqual({ eventsAttended: 0, serviceHours: 0 });
  });

  it('recounts every approved member', async () => {
    await db.doc('members/chris').set({ displayName: 'Sample Chris', status: 'approved' });
    await db.doc('members/zed').set({ displayName: 'Sample Zed', status: 'approved' });
    await db.doc('members/pete').set({ displayName: 'Sample Pete', status: 'pending' });
    await checkIn('e1', 'zed', 3);
    expect(await recountAllMemberStats(db)).toBe(2);
    expect(await stats('chris')).toMatchObject({ eventsAttended: 0, serviceHours: 0 });
    expect(await stats('zed')).toMatchObject({ eventsAttended: 1, serviceHours: 3 });
    expect(await stats('pete')).toBeUndefined();
  });
});
