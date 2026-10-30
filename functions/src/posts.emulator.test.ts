import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { cleanUpPost, recountCommentLikes, recountComments, recountLikes } from './posts';

// Runs against the Firestore emulator (npm run test:rules).

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'posts-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('posts'));
  await db.doc('posts/p').set({ authorId: 'a', caption: 'Hi', likeCount: 99, removed: false });
});

describe('recountLikes', () => {
  it('sets the count to the real number of likes, whatever it said before', async () => {
    for (const uid of ['a', 'b', 'c']) await db.doc(`posts/p/likes/${uid}`).set({ memberId: uid });
    expect(await recountLikes('p', db)).toBe(3);
    expect((await db.doc('posts/p').get()).get('likeCount')).toBe(3);
  });

  it('goes back to zero when the last like is removed, and running twice changes nothing', async () => {
    await db.doc('posts/p/likes/a').set({ memberId: 'a' });
    await recountLikes('p', db);
    await db.doc('posts/p/likes/a').delete();
    await recountLikes('p', db);
    await recountLikes('p', db);
    expect((await db.doc('posts/p').get()).get('likeCount')).toBe(0);
  });

  it('does nothing for a post that was deleted', async () => {
    await expect(recountLikes('gone', db)).resolves.toBe(0);
    expect((await db.doc('posts/gone').get()).exists).toBe(false);
  });
});

describe('comment counts', () => {
  it('counts comments on the post, replies included', async () => {
    await db.doc('posts/p/comments/c1').set({ authorId: 'a', text: 'Hi' });
    await db.doc('posts/p/comments/c2').set({ authorId: 'b', text: 'Yo', replyToId: 'c1' });
    expect(await recountComments('p', db)).toBe(2);
    expect((await db.doc('posts/p').get()).get('commentCount')).toBe(2);
    await db.doc('posts/p/comments/c2').delete();
    await recountComments('p', db);
    expect((await db.doc('posts/p').get()).get('commentCount')).toBe(1);
  });

  it('counts likes on a comment, and ignores a deleted comment', async () => {
    await db.doc('posts/p/comments/c1').set({ authorId: 'a', text: 'Hi' });
    await db.doc('posts/p/comments/c1/likes/a').set({ memberId: 'a' });
    await db.doc('posts/p/comments/c1/likes/b').set({ memberId: 'b' });
    expect(await recountCommentLikes('p', 'c1', db)).toBe(2);
    expect((await db.doc('posts/p/comments/c1').get()).get('likeCount')).toBe(2);
    await expect(recountCommentLikes('p', 'gone', db)).resolves.toBe(0);
  });
});

describe('cleanUpPost', () => {
  it('removes comments, their likes, likes and photos left under a deleted post', async () => {
    await db.doc('posts/p/comments/c1').set({ authorId: 'b', text: 'Hi' });
    await db.doc('posts/p/comments/c1/likes/a').set({ memberId: 'a' });
    await db.doc('posts/p/likes/b').set({ memberId: 'b' });
    await db.doc('posts/other/likes/b').set({ memberId: 'b' });
    await db.doc('posts/p').delete();
    const deleted: string[] = [];
    const bucket = { deleteFiles: async ({ prefix }: { prefix: string }) => deleted.push(prefix) };

    await cleanUpPost('p', 'a', { db, bucket });

    for (const path of ['posts/p/comments/c1', 'posts/p/comments/c1/likes/a', 'posts/p/likes/b']) {
      expect((await db.doc(path).get()).exists).toBe(false);
    }
    expect((await db.doc('posts/other/likes/b').get()).exists).toBe(true);
    expect(deleted).toEqual(['posts/a/p/']);
  });
});
