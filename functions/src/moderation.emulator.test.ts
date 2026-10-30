import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModerationError, resolveReports, undoDecision } from './moderation';

// Runs against the Firestore emulator (npm run test:rules). Expo's push API is faked.

let app: App;
let db: Firestore;
const NOW = new Date('2026-10-29T17:00:00Z');

function fakeExpo() {
  const sent: { to: string; body: string }[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
    const messages = JSON.parse(init.body) as { to: string; body: string }[];
    sent.push(...messages);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: messages.map(() => ({ status: 'ok' })) }),
    };
  });
  return { fetchImpl, sent };
}

async function member(uid: string, name: string, role?: { role: string; title?: string }) {
  await db
    .doc(`members/${uid}`)
    .set({ displayName: name, initiationTerm: 'Fall 2020', status: 'approved' });
  await db.doc(`pushTokens/${uid}/tokens/t`).set({ token: `ExponentPushToken[${uid}]` });
  if (role) await db.doc(`roles/${uid}`).set(role);
}

async function report(id: string, reporterId: string, extra: Record<string, unknown>) {
  await db.doc(`reports/${id}`).set({
    reporterId,
    reason: 'spam',
    status: 'open',
    createdAt: Timestamp.fromDate(NOW),
    ...extra,
  });
}

const POST = { targetType: 'post', postId: 'p1', targetAuthorId: 'author' };
const COMMENT = { targetType: 'comment', postId: 'p1', commentId: 'c1', targetAuthorId: 'author' };
const MEMBER = { targetType: 'member', targetAuthorId: 'author' };

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'moderation-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    'members',
    'roles',
    'pushTokens',
    'reports',
    'posts',
    'decisions',
    'restrictions',
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await member('olivia', 'Sample Olivia', { role: 'officer', title: 'Vice President' });
  await member('author', 'Sample Author');
  await member('alice', 'Sample Alice');
  await member('bob', 'Sample Bob');
  await db
    .doc('posts/p1')
    .set({ authorId: 'author', caption: 'Sample', removed: false, allowComments: true });
  await db.doc('posts/p1/comments/c1').set({ authorId: 'author', text: 'Sample comment' });
});

const status = async (id: string) => (await db.doc(`reports/${id}`).get()).get('status');

describe('resolveReports', () => {
  it('keeps: closes every report, logs the officer by name and tells each reporter once', async () => {
    await report('r1', 'alice', POST);
    await report('r2', 'bob', POST);
    await report('r3', 'alice', POST);
    const expo = fakeExpo();
    const { decisionId } = await resolveReports(
      db,
      'olivia',
      { reportIds: ['r1', 'r2', 'r3'], action: 'kept' },
      { db, fetchImpl: expo.fetchImpl, now: NOW },
    );
    expect(await status('r1')).toBe('kept');
    expect((await db.doc('reports/r2').get()).data()).toMatchObject({
      resolvedBy: 'olivia',
      decisionId,
    });
    const decision = (await db.doc(`decisions/${decisionId}`).get()).data();
    expect(decision).toMatchObject({
      kind: 'report',
      action: 'kept',
      targetType: 'post',
      postId: 'p1',
      by: 'olivia',
      byName: 'Sample Olivia',
      byTitle: 'Vice President',
      reportIds: ['r1', 'r2', 'r3'],
    });
    expect(expo.sent.map((m) => m.to).sort()).toEqual([
      'ExponentPushToken[alice]',
      'ExponentPushToken[bob]',
    ]);
    expect((await db.doc('posts/p1').get()).get('removed')).toBe(false);
  });

  it('removes a post, and undo brings it back and reopens the reports', async () => {
    await report('r1', 'alice', POST);
    const { decisionId } = await resolveReports(
      db,
      'olivia',
      { reportIds: ['r1'], action: 'removed' },
      { db, fetchImpl: fakeExpo().fetchImpl },
    );
    expect((await db.doc('posts/p1').get()).get('removed')).toBe(true);

    await undoDecision(db, 'olivia', decisionId);
    expect((await db.doc('posts/p1').get()).get('removed')).toBe(false);
    const r = (await db.doc('reports/r1').get()).data();
    expect(r?.status).toBe('open');
    expect(r).not.toHaveProperty('resolvedBy');
    expect((await db.doc(`decisions/${decisionId}`).get()).get('undone.by')).toBe('olivia');
  });

  it('removes a comment, and undo restores it without a new-comment notice', async () => {
    await report('r1', 'alice', COMMENT);
    const { decisionId } = await resolveReports(
      db,
      'olivia',
      { reportIds: ['r1'], action: 'removed' },
      { db, fetchImpl: fakeExpo().fetchImpl },
    );
    expect((await db.doc('posts/p1/comments/c1').get()).exists).toBe(false);

    await undoDecision(db, 'olivia', decisionId);
    const restored = (await db.doc('posts/p1/comments/c1').get()).data();
    expect(restored).toMatchObject({ authorId: 'author', text: 'Sample comment' });
    expect(restored?.restoredAt).toBeInstanceOf(Timestamp);
  });

  it('restricts a reported member for 7 days, and undo lifts it', async () => {
    await report('r1', 'alice', MEMBER);
    const { decisionId } = await resolveReports(
      db,
      'olivia',
      { reportIds: ['r1'], action: 'restricted' },
      { db, fetchImpl: fakeExpo().fetchImpl, now: NOW },
    );
    const restriction = (await db.doc('restrictions/author').get()).data();
    expect(restriction?.until.toMillis()).toBe(NOW.getTime() + 7 * 86_400_000);
    expect(restriction?.decisionId).toBe(decisionId);
    expect(await status('r1')).toBe('restricted');

    await undoDecision(db, 'olivia', decisionId);
    expect((await db.doc('restrictions/author').get()).exists).toBe(false);
  });

  it('undo leaves a newer restriction alone', async () => {
    await report('r1', 'alice', MEMBER);
    await report('r2', 'bob', POST);
    const first = await resolveReports(
      db,
      'olivia',
      { reportIds: ['r1'], action: 'restricted' },
      { db, fetchImpl: fakeExpo().fetchImpl },
    );
    const second = await resolveReports(
      db,
      'olivia',
      { reportIds: ['r2'], action: 'restricted' },
      { db, fetchImpl: fakeExpo().fetchImpl },
    );
    await undoDecision(db, 'olivia', first.decisionId);
    expect((await db.doc('restrictions/author').get()).get('decisionId')).toBe(second.decisionId);
  });

  it('refuses members, mixed targets, removing a member, handled reports and double undo', async () => {
    await report('r1', 'alice', POST);
    await report('r2', 'bob', COMMENT);
    await report('r3', 'bob', MEMBER);
    const deps = { db, fetchImpl: fakeExpo().fetchImpl };
    const code = (p: Promise<unknown>) =>
      p.then(
        () => 'ok',
        (e: ModerationError) => e.code,
      );

    expect(
      await code(resolveReports(db, 'alice', { reportIds: ['r1'], action: 'kept' }, deps)),
    ).toBe('permission-denied');
    expect(
      await code(resolveReports(db, 'olivia', { reportIds: ['r1', 'r2'], action: 'kept' }, deps)),
    ).toBe('invalid-argument');
    expect(
      await code(resolveReports(db, 'olivia', { reportIds: ['r3'], action: 'removed' }, deps)),
    ).toBe('invalid-argument');
    expect(
      await code(resolveReports(db, 'olivia', { reportIds: ['r1'], action: 'ban' }, deps)),
    ).toBe('invalid-argument');
    expect(
      await code(resolveReports(db, 'olivia', { reportIds: ['nope'], action: 'kept' }, deps)),
    ).toBe('not-found');

    const { decisionId } = await resolveReports(
      db,
      'olivia',
      { reportIds: ['r1'], action: 'kept' },
      deps,
    );
    expect(
      await code(resolveReports(db, 'olivia', { reportIds: ['r1'], action: 'kept' }, deps)),
    ).toBe('failed-precondition');
    await undoDecision(db, 'olivia', decisionId);
    expect(await code(undoDecision(db, 'olivia', decisionId))).toBe('failed-precondition');
    expect(await code(undoDecision(db, 'alice', decisionId))).toBe('permission-denied');
    expect(await status('r2')).toBe('open');
  });
});
