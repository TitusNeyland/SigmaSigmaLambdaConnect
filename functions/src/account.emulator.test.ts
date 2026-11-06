import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { deleteUserData, type BucketLike } from './account';

// Runs against the Firestore, Storage and Auth emulators (npm run test:rules).

const PROJECT_ID = 'demo-ssl-rules';
const BUCKET = `${PROJECT_ID}.appspot.com`;

let app: App;
let db: Firestore;
let auth: Auth;
let bucket: ReturnType<ReturnType<typeof getStorage>['bucket']>;

const now = () => Timestamp.now();

async function exists(path: string) {
  return (await db.doc(path).get()).exists;
}

async function fileExists(path: string) {
  const [found] = await bucket.file(path).exists();
  return found;
}

async function seed() {
  await auth.createUser({ uid: 'gone', email: 'gone@example.com', password: 'secret123' });
  await auth.createUser({ uid: 'stays', email: 'stays@example.com', password: 'secret123' });

  const writes: [string, Record<string, unknown>][] = [
    [
      'members/gone',
      {
        displayName: 'Leaving Member',
        initiationTerm: 'Fall 2020',
        status: 'approved',
        createdAt: now(),
      },
    ],
    [
      'members/stays',
      {
        displayName: 'Staying Member',
        initiationTerm: 'Fall 2021',
        status: 'approved',
        createdAt: now(),
      },
    ],
    ['members/gone/private/contact', { email: 'gone@example.com', phone: '555-0101' }],
    ['pushTokens/gone/tokens/t1', { token: 'ExponentPushToken[gone]', platform: 'ios' }],
    ['pushTokens/stays/tokens/t2', { token: 'ExponentPushToken[stays]', platform: 'ios' }],
    ['roles/gone', { role: 'officer', title: 'Secretary' }],
    ['blocks/gone/blocked/stays', { createdAt: now() }],
    // A post by the leaving member, with someone else's comment and like on it.
    [
      'posts/mine',
      {
        authorId: 'gone',
        caption: 'Mine',
        photoPaths: ['posts/gone/mine/1.jpg'],
        allowComments: true,
        official: false,
        removed: false,
        likeCount: 1,
        commentCount: 1,
        createdAt: now(),
      },
    ],
    ['posts/mine/comments/c1', { authorId: 'stays', text: 'Nice', createdAt: now() }],
    ['posts/mine/likes/stays', { memberId: 'stays', createdAt: now() }],
    // Someone else's post the leaving member commented on and liked.
    [
      'posts/theirs',
      {
        authorId: 'stays',
        caption: 'Theirs',
        photoPaths: [],
        allowComments: true,
        official: false,
        removed: false,
        likeCount: 2,
        commentCount: 2,
        createdAt: now(),
      },
    ],
    ['posts/theirs/comments/c2', { authorId: 'gone', text: 'Mine to delete', createdAt: now() }],
    ['posts/theirs/comments/c3', { authorId: 'stays', text: 'Stays', createdAt: now() }],
    ['posts/theirs/likes/gone', { memberId: 'gone', createdAt: now() }],
    ['posts/theirs/likes/stays', { memberId: 'stays', createdAt: now() }],
    // An event with an RSVP and attendance from both.
    [
      'events/e1',
      {
        title: 'Service Day',
        category: 'service',
        location: 'Food bank',
        startsAt: now(),
        createdBy: 'stays',
        createdAt: now(),
      },
    ],
    ['events/e1/rsvps/gone', { memberId: 'gone', status: 'going', updatedAt: now() }],
    ['events/e1/rsvps/stays', { memberId: 'stays', status: 'going', updatedAt: now() }],
    [
      'events/e1/attendance/gone',
      { memberId: 'gone', checkedInBy: 'stays', checkedInAt: now(), serviceHours: 4 },
    ],
    ['events/e1/attendance/stays', { memberId: 'stays', checkedInBy: 'stays', checkedInAt: now() }],
    ['reads/gone/announcements/a1', { readAt: now() }],
    ['activity/gone', { seenAt: now() }],
    [
      'committeeReports/r1',
      {
        authorId: 'gone',
        authorName: 'Sample Gone',
        committee: 'Service',
        period: 'October 2026',
        summary: 'Two cleanups.',
        emailStatus: 'sent',
      },
    ],
    ['memberStats/gone', { eventsAttended: 1, serviceHours: 4 }],
    ['activity/gone/items/like_mine_stays', { type: 'like', actorId: 'stays', postId: 'mine' }],
    ['hidden/gone/items/post_theirs', { targetType: 'post', postId: 'theirs', createdAt: now() }],
    ['restrictions/gone', { until: now(), by: 'stays', decisionId: 'd2' }],
    [
      'decisions/d1',
      {
        kind: 'membership',
        subjectId: 'gone',
        subjectName: 'Sample Gone',
        decision: 'approved',
        by: 'stays',
      },
    ],
    [
      'decisions/d2',
      {
        kind: 'report',
        action: 'removed',
        targetType: 'comment',
        targetAuthorId: 'gone',
        removedComment: { authorId: 'gone', text: 'Sample removed words' },
        by: 'stays',
        byName: 'Sample Stays',
      },
    ],
    [
      'decisions/d3',
      {
        kind: 'membership',
        subjectId: 'stays',
        subjectName: 'Sample Stays',
        by: 'gone',
        byName: 'Sample Gone',
      },
    ],
  ];
  for (const [path, data] of writes) await db.doc(path).set(data);

  for (const path of ['avatars/gone/1.jpg', 'posts/gone/mine/1.jpg', 'avatars/stays/1.jpg']) {
    await bucket.file(path).save(Buffer.from('jpg'), { contentType: 'image/jpeg' });
  }
}

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET }, 'account-test');
  db = getFirestore(app);
  auth = getAuth(app);
  bucket = getStorage(app).bucket();
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('members'));
  for (const name of [
    'roles',
    'blocks',
    'posts',
    'events',
    'reads',
    'activity',
    'memberStats',
    'committeeReports',
    'hidden',
    'restrictions',
    'decisions',
  ]) {
    await db.recursiveDelete(db.collection(name));
  }
  const { users } = await auth.listUsers();
  if (users.length) await auth.deleteUsers(users.map((u) => u.uid));
  await bucket.deleteFiles({ force: true });
  await seed();
});

describe('deleteUserData', () => {
  async function run() {
    return deleteUserData('gone', { db, bucket: bucket as unknown as BucketLike, auth });
  }

  it('removes the profile, private contact doc, role, block list and sign-in', async () => {
    await run();
    expect(await exists('members/gone')).toBe(false);
    expect(await exists('members/gone/private/contact')).toBe(false);
    expect(await exists('pushTokens/gone/tokens/t1')).toBe(false);
    expect(await exists('pushTokens/stays/tokens/t2')).toBe(true);
    expect(await exists('roles/gone')).toBe(false);
    expect(await exists('blocks/gone/blocked/stays')).toBe(false);
    await expect(auth.getUser('gone')).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });

  it('removes their posts along with every comment and like on them', async () => {
    await run();
    expect(await exists('posts/mine')).toBe(false);
    expect(await exists('posts/mine/comments/c1')).toBe(false);
    expect(await exists('posts/mine/likes/stays')).toBe(false);
  });

  it('removes their comments and likes on other posts and fixes those counts', async () => {
    await run();
    expect(await exists('posts/theirs/comments/c2')).toBe(false);
    expect(await exists('posts/theirs/likes/gone')).toBe(false);
    expect(await exists('posts/theirs/comments/c3')).toBe(true);
    expect(await exists('posts/theirs/likes/stays')).toBe(true);
    const theirs = (await db.doc('posts/theirs').get()).data()!;
    expect(theirs.commentCount).toBe(1);
    expect(theirs.likeCount).toBe(1);
  });

  it('removes their RSVPs but keeps attendance, which has no name on it', async () => {
    await run();
    expect(await exists('events/e1/rsvps/gone')).toBe(false);
    expect(await exists('events/e1/rsvps/stays')).toBe(true);
    const kept = (await db.doc('events/e1/attendance/gone').get()).data()!;
    expect(kept).toMatchObject({ memberId: 'gone', serviceHours: 4 });
    expect(Object.keys(kept)).not.toContain('displayName');
  });

  it('removes their read marks, hidden items, Activity and any posting pause', async () => {
    await run();
    expect(await exists('reads/gone/announcements/a1')).toBe(false);
    expect(await exists('activity/gone')).toBe(false);
    expect(await exists('memberStats/gone')).toBe(false);
    expect(await exists('activity/gone/items/like_mine_stays')).toBe(false);
    expect(await exists('hidden/gone/items/post_theirs')).toBe(false);
    expect(await exists('restrictions/gone')).toBe(false);
  });

  it('keeps committee reports they submitted, without their name or ID', async () => {
    await run();
    const r1 = (await db.doc('committeeReports/r1').get()).data()!;
    expect(r1).toMatchObject({ committee: 'Service', summary: 'Two cleanups.' });
    expect(r1).not.toHaveProperty('authorId');
    expect(r1).not.toHaveProperty('authorName');
  });

  it('takes their name and words out of the decision log but keeps the decisions', async () => {
    await run();
    const d1 = (await db.doc('decisions/d1').get()).data()!;
    expect(d1).toMatchObject({ subjectId: 'gone', decision: 'approved' });
    expect(d1).not.toHaveProperty('subjectName');
    const d2 = (await db.doc('decisions/d2').get()).data()!;
    expect(d2).not.toHaveProperty('removedComment');
    // The officer who decided is someone else; their name stays.
    expect(d2.byName).toBe('Sample Stays');
    const d3 = (await db.doc('decisions/d3').get()).data()!;
    expect(d3).not.toHaveProperty('byName');
    expect(d3.subjectName).toBe('Sample Stays');
  });

  it('removes their photos and nobody else’s', async () => {
    await run();
    expect(await fileExists('avatars/gone/1.jpg')).toBe(false);
    expect(await fileExists('posts/gone/mine/1.jpg')).toBe(false);
    expect(await fileExists('avatars/stays/1.jpg')).toBe(true);
  });

  it('leaves the other member completely alone', async () => {
    await run();
    expect(await exists('members/stays')).toBe(true);
    await expect(auth.getUser('stays')).resolves.toMatchObject({ uid: 'stays' });
  });

  it('reports what it removed', async () => {
    await expect(run()).resolves.toEqual({ posts: 1, comments: 1, likes: 1, rsvps: 1 });
  });

  it('can run again safely if a first attempt was interrupted', async () => {
    await run();
    await expect(run()).resolves.toEqual({ posts: 0, comments: 0, likes: 0, rsvps: 0 });
  });
});
