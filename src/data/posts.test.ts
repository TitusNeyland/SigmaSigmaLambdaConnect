import { deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';

import {
  createPost,
  deletePost,
  newPostId,
  postPhotoPath,
  updatePost,
  uploadPostPhoto,
} from './posts';

jest.mock('./firebase', () => ({ db: { name: 'db' }, storage: { name: 'storage' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: jest.fn((_p: unknown, ...s: string[]) =>
    s.length ? { path: s.join('/') } : { id: 'auto' },
  ),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'NOW'),
}));
type Observer = [
  (s: { bytesTransferred: number; totalBytes: number }) => void,
  (e: unknown) => void,
  () => void,
];
let mockTask: { observers: Observer | null } = { observers: null };
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(() => ({
    on: (_event: string, next: Observer[0], error: Observer[1], done: Observer[2]) => {
      mockTask.observers = [next, error, done];
    },
  })),
  getDownloadURL: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

it('makes an ID up front', () => {
  expect(newPostId()).toBe('auto');
});

it('stores photos where the storage rules let the author write, reporting progress', async () => {
  expect(postPhotoPath('me', 'p1', 2)).toBe('posts/me/p1/2.jpg');
  global.fetch = jest.fn(async () => ({ blob: async () => ({ size: 1 }) })) as never;
  const progress: number[] = [];
  const pending = uploadPostPhoto('me', 'p1', 0, 'file:///a.jpg', (f) => progress.push(f));
  await new Promise(process.nextTick);
  const [next, , done] = mockTask.observers!;
  next({ bytesTransferred: 50, totalBytes: 200 });
  next({ bytesTransferred: 200, totalBytes: 200 });
  done();
  expect(await pending).toBe('posts/me/p1/0.jpg');
  expect(progress).toEqual([0.25, 1, 1]);
  expect(ref).toHaveBeenCalledWith({ name: 'storage' }, 'posts/me/p1/0.jpg');
  expect(uploadBytesResumable).toHaveBeenCalledWith(
    { path: 'posts/me/p1/0.jpg' },
    { size: 1 },
    { contentType: 'image/jpeg' },
  );
});

it('fails the upload when Storage refuses it', async () => {
  global.fetch = jest.fn(async () => ({ blob: async () => ({ size: 1 }) })) as never;
  const pending = uploadPostPhoto('me', 'p1', 0, 'file:///a.jpg');
  await new Promise(process.nextTick);
  mockTask.observers![1](new Error('storage/unauthorized'));
  await expect(pending).rejects.toThrow('storage/unauthorized');
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

describe('edit and delete', () => {
  it('edits only the caption and comment setting', async () => {
    await updatePost('p1', { caption: '  New ', allowComments: true });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'posts/p1' },
      { caption: 'New', allowComments: true, updatedAt: 'NOW' },
    );
  });

  it('deletes the post', async () => {
    await deletePost('p1');
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'posts/p1' });
  });
});
