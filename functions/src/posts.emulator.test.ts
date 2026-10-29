import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { recountLikes } from './posts';

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
