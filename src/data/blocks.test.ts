import { collection, deleteDoc, doc, getDoc, onSnapshot } from 'firebase/firestore';

import { subscribeToBlocked, unblock } from './blocks';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  collection: jest.fn((_db: unknown, ...segments: string[]) => ({
    collection: segments.join('/'),
  })),
  onSnapshot: jest.fn(),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

const blockedDoc = (id: string, ms: number) => ({
  id,
  data: () => ({ createdAt: { toMillis: () => ms } }),
});
const member = (data: Record<string, unknown> | null) => ({
  exists: () => data !== null,
  data: () => data ?? {},
});

function start() {
  const onChange = jest.fn();
  const onError = jest.fn();
  subscribeToBlocked('me', onChange, onError);
  const next = jest.mocked(onSnapshot).mock.calls[0][1] as unknown as (s: object) => void;
  return { next, onChange, onError };
}

it('listens to the member’s own blocked list', () => {
  start();
  expect(collection).toHaveBeenCalledWith({ name: 'db' }, 'blocks', 'me', 'blocked');
});

it('lists blocked people newest first with their names', async () => {
  jest
    .mocked(getDoc)
    .mockImplementation(async (ref: unknown) =>
      (ref as { path: string }).path === 'members/b'
        ? (member({ displayName: 'Brandon Lee', photoURL: 'https://cdn.test/b.jpg' }) as never)
        : (member({ displayName: 'Chris Baptiste' }) as never),
    );
  const { next, onChange } = start();
  next({ docs: [blockedDoc('c', 100), blockedDoc('b', 200)] });
  await new Promise(process.nextTick);
  expect(onChange).toHaveBeenCalledWith([
    { uid: 'b', displayName: 'Brandon Lee', photoURL: 'https://cdn.test/b.jpg' },
    { uid: 'c', displayName: 'Chris Baptiste', photoURL: null },
  ]);
});

it('shows Former member when the profile is gone or unreadable', async () => {
  jest
    .mocked(getDoc)
    .mockResolvedValueOnce(member(null) as never)
    .mockRejectedValueOnce(new Error('permission-denied'));
  const { next, onChange } = start();
  next({ docs: [blockedDoc('x', 2), blockedDoc('y', 1)] });
  await new Promise(process.nextTick);
  expect(onChange).toHaveBeenCalledWith([
    { uid: 'x', displayName: 'Former member', photoURL: null },
    { uid: 'y', displayName: 'Former member', photoURL: null },
  ]);
});

it('ignores a slow older snapshot that finishes after a newer one', async () => {
  let releaseOld: (v: unknown) => void = () => {};
  jest
    .mocked(getDoc)
    .mockImplementationOnce(() => new Promise((r) => (releaseOld = r)) as never)
    .mockResolvedValueOnce(member({ displayName: 'New' }) as never);
  const { next, onChange } = start();
  next({ docs: [blockedDoc('old', 1)] });
  next({ docs: [blockedDoc('new', 2)] });
  await new Promise(process.nextTick);
  releaseOld(member({ displayName: 'Old' }));
  await new Promise(process.nextTick);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([{ uid: 'new', displayName: 'New', photoURL: null }]);
});

it('unblock deletes the block document', async () => {
  await unblock('me', 'b');
  expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'blocks', 'me', 'blocked', 'b');
  expect(deleteDoc).toHaveBeenCalledWith({ path: 'blocks/me/blocked/b' });
});
