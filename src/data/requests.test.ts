import { getDocs, Timestamp, updateDoc } from 'firebase/firestore';

import { decideRequest, fetchPendingRequests } from './requests';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    mockMs: number;
    constructor(ms: number) {
      this.mockMs = ms;
    }
    toDate() {
      return new Date(this.mockMs);
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
    doc: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ...ref, parts })),
    where: jest.fn((...a: unknown[]) => ({ where: a })),
    getDocs: jest.fn(),
    updateDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);
beforeEach(() => jest.clearAllMocks());

it('lists pending members oldest first', async () => {
  const docs = [
    {
      id: 'new',
      data: () => ({ displayName: 'Sample New', initiationTerm: 'Fall 2025', createdAt: ts(300) }),
    },
    {
      id: 'old',
      data: () => ({
        displayName: 'Sample Old',
        initiationTerm: 'Fall 2019',
        createdAt: ts(100),
        photoURL: 'p.jpg',
      }),
    },
    { id: 'odd', data: () => ({ displayName: 42 }) },
  ];
  jest.mocked(getDocs).mockResolvedValue({ docs } as never);
  const list = await fetchPendingRequests();
  expect(jest.mocked(getDocs).mock.calls[0][0]).toMatchObject({
    path: 'members',
    parts: [{ where: ['status', '==', 'pending'] }],
  });
  expect(list).toEqual([
    {
      uid: 'old',
      displayName: 'Sample Old',
      initiationTerm: 'Fall 2019',
      photoURL: 'p.jpg',
      requestedAt: new Date(100),
    },
    {
      uid: 'new',
      displayName: 'Sample New',
      initiationTerm: 'Fall 2025',
      photoURL: null,
      requestedAt: new Date(300),
    },
    { uid: 'odd', displayName: '', initiationTerm: '', photoURL: null, requestedAt: null },
  ]);
});

it('records the decision and who made it, matching the rules', async () => {
  await decideRequest('pete', 'olivia', 'approved');
  expect(updateDoc).toHaveBeenCalledWith(
    { path: 'members/pete' },
    { status: 'approved', reviewedBy: 'olivia', reviewedAt: 'NOW' },
  );
  await decideRequest('pete', 'olivia', 'declined');
  expect(jest.mocked(updateDoc).mock.calls[1][1]).toMatchObject({ status: 'declined' });
});
