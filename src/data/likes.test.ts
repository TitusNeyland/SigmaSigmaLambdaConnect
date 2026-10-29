import { deleteDoc, setDoc } from 'firebase/firestore';

import { likePost, unlikePost } from './likes';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'NOW'),
}));

it('likes with exactly the fields the rules allow, under the member’s own ID', async () => {
  await likePost('p1', 'me');
  expect(setDoc).toHaveBeenCalledWith(
    { path: 'posts/p1/likes/me' },
    { memberId: 'me', createdAt: 'NOW' },
  );
});

it('unlikes by removing the like', async () => {
  await unlikePost('p1', 'me');
  expect(deleteDoc).toHaveBeenCalledWith({ path: 'posts/p1/likes/me' });
});
