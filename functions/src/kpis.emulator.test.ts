import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { computeKpis, isApprovedOfficer } from './kpis';

// Runs against the Firestore emulator (npm run test:rules).

let app: App;
let db: Firestore;

const NOW = new Date('2026-10-29T17:00:00Z');
const at = (iso: string) => Timestamp.fromDate(new Date(iso));

async function member(uid: string, status = 'approved') {
  await db
    .doc(`members/${uid}`)
    .set({ displayName: `Sample ${uid}`, initiationTerm: 'Fall 2020', status });
}

async function event(
  id: string,
  startsAt: string,
  checkIns: Record<string, number | null>,
  extra = {},
) {
  await db.doc(`events/${id}`).set({ title: `Sample ${id}`, startsAt: at(startsAt), ...extra });
  for (const [uid, hours] of Object.entries(checkIns)) {
    await db.doc(`events/${id}/attendance/${uid}`).set({
      memberId: uid,
      checkedInBy: 'olivia',
      checkedInAt: at(startsAt),
      ...(hours === null ? {} : { serviceHours: hours }),
    });
  }
}

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'kpis-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'events', 'posts', 'goals', 'kpis', 'roles']) {
    await db.recursiveDelete(db.collection(c));
  }
  for (const uid of ['a', 'b', 'c', 'd']) await member(uid);
  await member('pete', 'pending');
});

describe('computeKpis', () => {
  it('computes each period from check-ins, not RSVPs, and saves them', async () => {
    // Spring (last chapter year), fall but over 30 days ago, and this week.
    await event('spring', '2026-04-10T23:00:00Z', { a: null, b: null, c: null, d: null });
    await event('sept', '2026-09-12T15:00:00Z', { a: 4, b: 2 });
    await event('recent', '2026-10-24T15:00:00Z', { a: 3, pete: 5 });
    // RSVPs alone never count.
    await db.doc('events/recent/rsvps/c').set({ memberId: 'c', status: 'going' });
    await event('cancelled', '2026-10-20T15:00:00Z', { d: 8 }, { cancelled: true });
    await event('future', '2026-11-20T15:00:00Z', {});
    await db
      .doc('posts/p1')
      .set({ authorId: 'd', removed: false, createdAt: at('2026-10-25T12:00:00Z') });
    await db
      .doc('posts/p2')
      .set({ authorId: 'c', removed: true, createdAt: at('2026-10-25T12:00:00Z') });

    const current = await computeKpis(db, NOW);

    expect(current.semester).toMatchObject({
      period: '2026-fall',
      eventsHeld: 2,
      participationRate: 0.5,
      attendanceRate: 0.375,
      serviceHours: 9,
      activeMembers: 3,
      totalMembers: 4,
    });
    expect(current.year).toMatchObject({ period: '2026-27', eventsHeld: 2 });
    expect(current.days30).toMatchObject({
      period: 'last-30-days',
      eventsHeld: 1,
      participationRate: 0.25,
      serviceHours: 3,
      activeMembers: 2,
    });

    const saved = (await db.doc('kpis/current').get()).data();
    expect(saved?.semester.period).toBe('2026-fall');
    expect((await db.doc('kpis/2026-fall').get()).get('serviceHours')).toBe(9);
    expect((await db.doc('kpis/last-30-days').get()).get('eventsHeld')).toBe(1);
  });

  it('checks this chapter year’s goals and ignores other years', async () => {
    await event('sept', '2026-09-12T15:00:00Z', { a: 6, b: 6, c: null });
    await db.doc('goals/hours').set({
      name: 'Service hours',
      metric: 'service_hours',
      target: 10,
      unit: 'hours',
      chapterYear: '2026-27',
      done: false,
    });
    await db.doc('goals/part').set({
      name: 'Participation',
      metric: 'participation',
      target: 80,
      unit: 'percent',
      chapterYear: '2026-27',
      done: false,
    });
    await db.doc('goals/old').set({
      name: 'Old goal',
      metric: 'custom',
      target: 1,
      unit: 'count',
      chapterYear: '2025-26',
      done: true,
    });

    const current = await computeKpis(db, NOW);
    expect(current.semester.goalsTotal).toBe(2);
    expect(current.semester.goalsDone).toBe(1);
    expect(current.days30.goals.map((g) => [g.id, g.value, g.met])).toEqual([
      ['part', 75, false],
      ['hours', 12, true],
    ]);
  });

  it('writes empty numbers when nothing has happened', async () => {
    const current = await computeKpis(db, NOW);
    expect(current.semester).toMatchObject({
      participationRate: null,
      attendanceRate: null,
      serviceHours: 0,
      activeMembers: 0,
      eventsHeld: 0,
      goalsTotal: 0,
    });
  });
});

describe('isApprovedOfficer', () => {
  it('is true only for approved officers and admins', async () => {
    await db.doc('roles/a').set({ role: 'officer', title: 'Secretary' });
    await db.doc('roles/b').set({ role: 'admin' });
    await db.doc('roles/pete').set({ role: 'officer' });
    expect(await isApprovedOfficer(db, 'a')).toBe(true);
    expect(await isApprovedOfficer(db, 'b')).toBe(true);
    expect(await isApprovedOfficer(db, 'c')).toBe(false);
    expect(await isApprovedOfficer(db, 'pete')).toBe(false);
    expect(await isApprovedOfficer(db, 'nobody')).toBe(false);
  });
});
