import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';

export const PROJECT_ID = 'demo-ssl-rules';

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  const root = resolve(__dirname, '..', '..');
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(root, 'storage.rules'), 'utf8') },
  });
}

/** Sample people. All fake. */
export const USERS = {
  alice: 'alice', // approved member, accepted guidelines
  bob: 'bob', // approved member, hasn't accepted guidelines
  olivia: 'olivia', // approved officer
  adam: 'adam', // approved admin
  pete: 'pete', // pending
  dee: 'dee', // declined
  stranger: 'stranger', // signed in, no member profile
  rogue: 'rogue', // pending, but has a roles doc (should not count)
} as const;

const now = () => Timestamp.now();
const hoursFromNow = (h: number) => Timestamp.fromMillis(Date.now() + h * 3600_000);

export function member(status: 'pending' | 'approved' | 'declined', extra: object = {}) {
  return {
    displayName: 'Sample Member',
    initiationTerm: 'Spring 2020',
    status,
    createdAt: now(),
    ...extra,
  };
}

export function eventDoc(extra: object = {}) {
  return {
    title: 'Service Day',
    category: 'service',
    location: 'Food bank',
    startsAt: hoursFromNow(48),
    rsvpDeadline: hoursFromNow(24),
    createdBy: USERS.olivia,
    createdAt: now(),
    ...extra,
  };
}

export function postDoc(authorId: string, extra: object = {}) {
  return {
    authorId,
    caption: 'Great turnout today',
    photoPaths: [`posts/${authorId}/p1/1.jpg`],
    allowComments: true,
    official: false,
    removed: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: now(),
    ...extra,
  };
}

/** Seeds the standard people plus one event and one post, with rules off. */
export async function seedBase(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const put = (path: string, data: object) => setDoc(doc(db, path), data);
    await Promise.all([
      put(`members/${USERS.alice}`, member('approved', { guidelinesAcceptedAt: now() })),
      put(`members/${USERS.bob}`, member('approved')),
      put(`members/${USERS.olivia}`, member('approved', { guidelinesAcceptedAt: now() })),
      put(`members/${USERS.adam}`, member('approved', { guidelinesAcceptedAt: now() })),
      put(`members/${USERS.pete}`, member('pending')),
      put(`members/${USERS.dee}`, member('declined')),
      put(`members/${USERS.rogue}`, member('pending')),
      put(`roles/${USERS.olivia}`, { role: 'officer', title: 'Service Chair' }),
      put(`roles/${USERS.adam}`, { role: 'admin', title: 'President' }),
      put(`roles/${USERS.rogue}`, { role: 'admin' }),
      put('events/open', eventDoc()),
      put('events/closed', eventDoc({ rsvpDeadline: hoursFromNow(-1) })),
      put('events/cancelled', eventDoc({ cancelled: true })),
      put('posts/alicePost', postDoc(USERS.alice)),
      put('posts/removedPost', postDoc(USERS.alice, { removed: true })),
      put('posts/noComments', postDoc(USERS.alice, { allowComments: false })),
      put('posts/alicePost/comments/c1', {
        authorId: USERS.alice,
        text: 'First',
        createdAt: now(),
      }),
      put('posts/alicePost/likes/alice', { memberId: USERS.alice, createdAt: now() }),
      put('events/open/attendance/alice', {
        memberId: USERS.alice,
        checkedInBy: USERS.olivia,
        checkedInAt: now(),
        serviceHours: 4,
      }),
      put('events/open/attendance/bob', {
        memberId: USERS.bob,
        checkedInBy: USERS.olivia,
        checkedInAt: now(),
      }),
      put('reports/r1', {
        reporterId: USERS.bob,
        targetType: 'post',
        postId: 'alicePost',
        targetAuthorId: USERS.alice,
        reason: 'spam',
        status: 'open',
        createdAt: now(),
      }),
      put('programs/scholarship', { name: 'Scholarship', status: 'in_progress' }),
      put('programs/scholarship/milestones/m1', { name: 'Form committee', order: 1, done: true }),
      put('goals/g1', { name: 'Service hours', target: 600 }),
      put('announcements/a1', { title: 'Dues', body: 'Due Nov 15', pinned: true }),
      put('kpis/2026-fall', { participationRate: 0.68 }),
      put(`blocks/${USERS.alice}/blocked/${USERS.bob}`, { createdAt: now() }),
    ]);
  });
}
