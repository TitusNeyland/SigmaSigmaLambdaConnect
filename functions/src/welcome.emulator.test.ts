import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { postWelcome } from './welcome';

// Runs against the Firestore emulator (npm run test:rules).

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-ssl-rules' }, 'welcome-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('posts'));
});

const pending = { status: 'pending', displayName: 'Sample Reed', initiationTerm: 'Spring 2019' };
const approved = {
  ...pending,
  status: 'approved',
  reviewedBy: 'officer1',
  industry: 'Real estate',
  businesses: ['Sample Realty'],
};

describe('welcome post on approval', () => {
  it('posts an official welcome by the approving officer, tagging the new brother', async () => {
    expect(await postWelcome('new1', pending, approved, db)).toBe(true);
    const post = (await db.doc('posts/welcome-new1').get()).data();
    expect(post).toMatchObject({
      authorId: 'officer1',
      official: true,
      removed: false,
      photoPaths: [],
      taggedMemberIds: ['new1'],
      allowComments: true,
      likeCount: 0,
      commentCount: 0,
      welcomeFor: 'new1',
    });
    expect(post?.caption).toBe(
      'Please welcome Brother Sample Reed to the chapter! Spring 2019 line. Works in Real estate. Owns Sample Realty. Say hello and welcome him in.',
    );
    expect(post?.createdAt).toBeTruthy();
  });

  it('welcomes him once, even if he’s approved again later', async () => {
    await postWelcome('new1', pending, approved, db);
    await db.doc('posts/welcome-new1').update({ caption: 'First one' });
    expect(await postWelcome('new1', pending, { ...approved, reviewedBy: 'officer2' }, db)).toBe(
      false,
    );
    expect((await db.doc('posts/welcome-new1').get()).get('caption')).toBe('First one');
  });

  it('only on going from pending to approved, and only with an approving officer', async () => {
    expect(await postWelcome('a', approved, approved, db)).toBe(false);
    expect(await postWelcome('b', pending, { ...approved, status: 'declined' }, db)).toBe(false);
    expect(await postWelcome('c', pending, { ...approved, reviewedBy: '' }, db)).toBe(false);
    expect((await db.collection('posts').get()).size).toBe(0);
  });
});
