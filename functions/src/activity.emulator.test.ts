import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  recordComment,
  recordLike,
  removeCommentItems,
  removeLike,
  removePostItems,
} from './activity';

// Runs against the Firestore emulator (npm run test:rules).

let app: App;
let db: Firestore;

const items = async (uid: string) =>
  (await db.collection(`activity/${uid}/items`).get()).docs.map((d) => d.id).sort();
const item = async (uid: string, id: string) =>
  (await db.doc(`activity/${uid}/items/${id}`).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'activity-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of ['members', 'posts', 'activity', 'hidden']) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc('members/author').set({ displayName: 'Sample Marcus', status: 'approved' });
  await db.doc('members/chris').set({
    displayName: 'Sample Chris',
    status: 'approved',
    photoURL: 'https://example.test/chris.jpg',
  });
  await db.doc('members/zed').set({ displayName: 'Sample Zed', status: 'approved' });
  await db.doc('posts/p1').set({
    authorId: 'author',
    caption: 'Gala',
    photoPaths: ['posts/author/p1/0.jpg'],
    removed: false,
  });
  await db.doc('posts/text').set({ authorId: 'author', caption: 'Hi', photoPaths: [] });
});

describe('likes', () => {
  it('adds a like to the author’s Activity, with who and the photo', async () => {
    const likedAt = Timestamp.fromMillis(Date.UTC(2026, 10, 5, 12));
    expect(await recordLike('p1', 'chris', likedAt, db)).toBe(true);
    expect(await item('author', 'like_p1_chris')).toEqual({
      type: 'like',
      actorId: 'chris',
      actorName: 'Sample Chris',
      actorPhotoURL: 'https://example.test/chris.jpg',
      postId: 'p1',
      photoPath: 'posts/author/p1/0.jpg',
      at: likedAt,
    });
  });

  it('adds nothing for liking your own post, or a removed one', async () => {
    await db.doc('posts/gone').set({ authorId: 'author', removed: true });
    expect(await recordLike('p1', 'author', undefined, db)).toBe(false);
    expect(await recordLike('gone', 'chris', undefined, db)).toBe(false);
    expect(await items('author')).toEqual([]);
  });

  it('liking twice keeps one item, and an unlike takes it out', async () => {
    await recordLike('text', 'chris', undefined, db);
    await recordLike('text', 'chris', undefined, db);
    expect(await items('author')).toEqual(['like_text_chris']);
    expect((await item('author', 'like_text_chris'))?.photoPath).toBeNull();
    await removeLike('text', 'chris', db);
    expect(await items('author')).toEqual([]);
  });
});

describe('comments and replies', () => {
  it('adds a comment to the author’s Activity, with a preview', async () => {
    expect(
      await recordComment('p1', 'c1', { authorId: 'chris', text: '  Great   night  ' }, db),
    ).toBe(1);
    expect(await item('author', 'comment_c1')).toMatchObject({
      type: 'comment',
      actorName: 'Sample Chris',
      postId: 'p1',
      commentId: 'c1',
      text: 'Great night',
    });
  });

  it('adds nothing for your own comment', async () => {
    expect(await recordComment('p1', 'c1', { authorId: 'author', text: 'Thanks' }, db)).toBe(0);
  });

  it('tells the person replied to, and the post’s author once', async () => {
    await db.doc('posts/p1/comments/z1').set({ authorId: 'zed', text: 'Who’s going?' });
    await recordComment('p1', 'c2', { authorId: 'chris', text: 'Me', replyToId: 'z1' }, db);
    expect(await items('zed')).toEqual(['reply_c2']);
    expect(await items('author')).toEqual(['comment_c2']);

    // A reply to the author's own comment shows once, as a reply.
    await db.doc('posts/p1/comments/a1').set({ authorId: 'author', text: 'Thanks' });
    await recordComment('p1', 'c3', { authorId: 'chris', text: 'Anytime', replyToId: 'a1' }, db);
    expect(await items('author')).toEqual(['comment_c2', 'reply_c3']);
  });

  it('a deleted comment leaves Activity', async () => {
    await db.doc('posts/p1/comments/z1').set({ authorId: 'zed', text: 'Hi' });
    await recordComment('p1', 'c2', { authorId: 'chris', text: 'Yo', replyToId: 'z1' }, db);
    expect(await removeCommentItems('c2', db)).toBe(2);
    expect(await items('zed')).toEqual([]);
    expect(await items('author')).toEqual([]);
  });
});

it('a deleted post takes its items out of everyone’s Activity, and nothing else', async () => {
  await db.doc('posts/p1/comments/z1').set({ authorId: 'zed', text: 'Hi' });
  await recordLike('p1', 'chris', undefined, db);
  await recordComment('p1', 'c2', { authorId: 'chris', text: 'Yo', replyToId: 'z1' }, db);
  await recordLike('text', 'chris', undefined, db);
  // A member's hidden posts share the "items" name but aren't Activity.
  await db.doc('hidden/zed/items/post_p1').set({ targetType: 'post', postId: 'p1' });

  expect(await removePostItems('p1', db)).toBe(3);
  expect(await items('author')).toEqual(['like_text_chris']);
  expect(await items('zed')).toEqual([]);
  expect((await db.doc('hidden/zed/items/post_p1').get()).exists).toBe(true);
});
