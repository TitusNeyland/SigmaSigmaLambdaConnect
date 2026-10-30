import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyComment, queueLike, sendLikeDigests, unqueueLike } from './social';

// Runs against the Firestore emulator (npm run test:rules). Expo's API is faked.

let app: App;
let db: Firestore;

function fakeExpo() {
  const sent: { to: string; title: string; body: string }[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
    const messages = JSON.parse(init.body) as { to: string; title: string; body: string }[];
    sent.push(...messages);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: messages.map(() => ({ status: 'ok' })) }),
    };
  });
  const to = (uid: string) =>
    sent.filter((m) => m.to === `ExponentPushToken[${uid}]`).map((m) => m.title);
  return { fetchImpl, sent, to };
}

async function member(uid: string, name: string, prefs?: Record<string, boolean>) {
  await db.doc(`members/${uid}`).set({
    displayName: name,
    initiationTerm: 'Fall 2020',
    status: 'approved',
    ...(prefs ? { notificationPrefs: prefs } : {}),
  });
  await db.doc(`pushTokens/${uid}/tokens/t`).set({ token: `ExponentPushToken[${uid}]` });
}

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'social-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'pushTokens', 'posts', 'likeDigests', 'blocks']) {
    await db.recursiveDelete(db.collection(c));
  }
  await member('author', 'Marcus Reed');
  await member('chris', 'Chris Baptiste');
  await member('zed', 'Zed Allen');
  await member('quiet', 'Quiet Brother', { social: false });
  await db.doc('posts/p1').set({ authorId: 'author', caption: 'Gala', removed: false });
  await db.doc('posts/p2').set({ authorId: 'author', caption: 'Mixer', removed: false });
  await db.doc('posts/quietPost').set({ authorId: 'quiet', caption: 'Hi', removed: false });
});

describe('comment notifications', () => {
  it('tells the post’s author, but not about their own comments', async () => {
    const expo = fakeExpo();
    const deps = { db, fetchImpl: expo.fetchImpl };
    await notifyComment('p1', { authorId: 'chris', text: 'Great night' }, deps);
    await notifyComment('p1', { authorId: 'author', text: 'Thanks all' }, deps);
    expect(expo.to('author')).toEqual(['Chris Baptiste commented on your post']);
    expect(expo.sent[0].body).toBe('Great night');
  });

  it('tells the person replied to, and the post’s author once', async () => {
    await db.doc('posts/p1/comments/c1').set({ authorId: 'zed', text: 'Who’s going?' });
    const expo = fakeExpo();
    await notifyComment(
      'p1',
      { authorId: 'chris', text: 'Me', replyToId: 'c1' },
      { db, fetchImpl: expo.fetchImpl },
    );
    expect(expo.to('zed')).toEqual(['Chris Baptiste replied to your comment']);
    expect(expo.to('author')).toEqual(['Chris Baptiste commented on your post']);

    // A reply to the post author's own comment sends them just the reply notice.
    await db.doc('posts/p1/comments/c2').set({ authorId: 'author', text: 'Tickets?' });
    const again = fakeExpo();
    await notifyComment(
      'p1',
      { authorId: 'chris', text: 'Yes', replyToId: 'c2' },
      { db, fetchImpl: again.fetchImpl },
    );
    expect(again.to('author')).toEqual(['Chris Baptiste replied to your comment']);
  });

  it('respects the Likes and comments switch and blocks', async () => {
    const expo = fakeExpo();
    await notifyComment(
      'quietPost',
      { authorId: 'chris', text: 'Hey' },
      { db, fetchImpl: expo.fetchImpl },
    );
    await db.doc('blocks/author/blocked/zed').set({ createdAt: new Date() });
    await notifyComment('p1', { authorId: 'zed', text: 'Hey' }, { db, fetchImpl: expo.fetchImpl });
    expect(expo.sent).toEqual([]);
  });
});

describe('like digests', () => {
  it('queues likes and sends one batched notification per author, then clears', async () => {
    for (const [post, liker] of [
      ['p1', 'chris'],
      ['p1', 'zed'],
      ['p2', 'chris'],
      ['p1', 'author'], // liking your own post queues nothing
    ]) {
      await queueLike(post, liker, db);
    }
    expect((await db.collection('likeDigests/author/pending').get()).size).toBe(3);
    const expo = fakeExpo();
    expect(await sendLikeDigests({ db, fetchImpl: expo.fetchImpl })).toEqual({ digests: 1 });
    expect(expo.to('author')).toHaveLength(1);
    expect(expo.to('author')[0]).toMatch(
      /^(Chris Baptiste|Zed Allen) and 1 other liked your posts$/,
    );
    expect((await db.collection('likeDigests/author/pending').get()).size).toBe(0);

    const again = fakeExpo();
    expect(await sendLikeDigests({ db, fetchImpl: again.fetchImpl })).toEqual({ digests: 0 });
    expect(again.sent).toEqual([]);
  });

  it('an unlike before the digest takes the like back out', async () => {
    await queueLike('p1', 'chris', db);
    await unqueueLike('p1', 'chris', db);
    const expo = fakeExpo();
    await sendLikeDigests({ db, fetchImpl: expo.fetchImpl });
    expect(expo.sent).toEqual([]);
  });

  it('respects the switch and leaves out people the author blocked', async () => {
    await queueLike('quietPost', 'chris', db);
    await db.doc('blocks/author/blocked/zed').set({ createdAt: new Date() });
    await queueLike('p1', 'zed', db);
    const expo = fakeExpo();
    await sendLikeDigests({ db, fetchImpl: expo.fetchImpl });
    expect(expo.sent).toEqual([]);
    expect((await db.collection('likeDigests/quiet/pending').get()).size).toBe(0);
  });
});
