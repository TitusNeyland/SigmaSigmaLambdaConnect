import { setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

import { createPost, newPostId, postPhotoPath, uploadPostPhoto } from './posts';

jest.mock('./firebase', () => ({ db: { name: 'db' }, storage: { name: 'storage' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: jest.fn((_p: unknown, ...s: string[]) =>
    s.length ? { path: s.join('/') } : { id: 'auto' },
  ),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'NOW'),
}));
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

it('makes an ID up front', () => {
  expect(newPostId()).toBe('auto');
});

it('stores photos where the storage rules let the author write', async () => {
  expect(postPhotoPath('me', 'p1', 2)).toBe('posts/me/p1/2.jpg');
  global.fetch = jest.fn(async () => ({ blob: async () => ({ size: 1 }) })) as never;
  expect(await uploadPostPhoto('me', 'p1', 0, 'file:///a.jpg')).toBe('posts/me/p1/0.jpg');
  expect(ref).toHaveBeenCalledWith({ name: 'storage' }, 'posts/me/p1/0.jpg');
  expect(uploadBytes).toHaveBeenCalledWith(
    { path: 'posts/me/p1/0.jpg' },
    { size: 1 },
    {
      contentType: 'image/jpeg',
    },
  );
});

it('creates the post with exactly the fields the rules allow', async () => {
  await createPost('p1', 'me', {
    caption: 'Hi',
    photoPaths: ['posts/me/p1/0.jpg'],
    eventId: 'gala',
    taggedMemberIds: ['a'],
    allowComments: false,
  });
  expect(setDoc).toHaveBeenCalledWith(
    { path: 'posts/p1' },
    {
      authorId: 'me',
      caption: 'Hi',
      photoPaths: ['posts/me/p1/0.jpg'],
      eventId: 'gala',
      taggedMemberIds: ['a'],
      allowComments: false,
      official: false,
      removed: false,
      likeCount: 0,
      commentCount: 0,
      createdAt: 'NOW',
    },
  );
});
