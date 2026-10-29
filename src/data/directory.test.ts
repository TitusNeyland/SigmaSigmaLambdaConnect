import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { fetchDirectory } from './directory';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  where: jest.fn((...args: unknown[]) => ({ where: args })),
  limit: jest.fn((n: number) => ({ limit: n })),
  query: jest.fn((ref: { collection: string }, ...parts: unknown[]) => ({ ...ref, parts })),
  getDocs: jest.fn(),
}));

const snap = (docs: Record<string, Record<string, unknown>>) => ({
  docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })),
});

function respond(
  members: Record<string, Record<string, unknown>>,
  roles: Record<string, Record<string, unknown>> = {},
) {
  jest
    .mocked(getDocs)
    .mockImplementation(async (ref: unknown) =>
      (ref as { collection: string }).collection === 'members'
        ? (snap(members) as never)
        : (snap(roles) as never),
    );
}

beforeEach(() => jest.clearAllMocks());

it('only asks for approved members', async () => {
  respond({});
  await fetchDirectory();
  expect(collection).toHaveBeenCalledWith({ name: 'db' }, 'members');
  expect(where).toHaveBeenCalledWith('status', '==', 'approved');
  expect(limit).toHaveBeenCalled();
  expect(query).toHaveBeenCalled();
  expect(collection).toHaveBeenCalledWith({ name: 'db' }, 'roles');
});

it('joins each member with their role and cleans up the fields', async () => {
  respond(
    {
      a: {
        displayName: ' Marcus Reed ',
        headline: 'Engineer',
        initiationTerm: 'Spring 2019',
        interests: ['Tech', '', 3],
        photoURL: 'https://cdn.test/a.jpg',
      },
      b: { displayName: 'Chris Baptiste' },
    },
    { a: { role: 'officer', title: 'Treasurer' }, ghost: { role: 'nonsense' } },
  );
  expect(await fetchDirectory()).toEqual([
    {
      uid: 'a',
      displayName: 'Marcus Reed',
      headline: 'Engineer',
      initiationTerm: 'Spring 2019',
      interests: ['Tech'],
      photoURL: 'https://cdn.test/a.jpg',
      role: { role: 'officer', title: 'Treasurer' },
    },
    {
      uid: 'b',
      displayName: 'Chris Baptiste',
      headline: '',
      initiationTerm: '',
      interests: [],
      photoURL: null,
      role: null,
    },
  ]);
});

it('skips members without a name', async () => {
  respond({ a: { displayName: '  ' }, b: {} });
  expect(await fetchDirectory()).toEqual([]);
});

it('fails when Firestore fails', async () => {
  jest.mocked(getDocs).mockRejectedValue(new Error('permission-denied'));
  await expect(fetchDirectory()).rejects.toThrow('permission-denied');
});
