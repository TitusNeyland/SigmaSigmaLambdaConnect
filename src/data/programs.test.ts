import { getDoc, getDocs, orderBy, Timestamp, writeBatch } from 'firebase/firestore';

import { fetchProgram, fetchPrograms, setMilestoneDone, toProgram } from './programs';

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
    orderBy: jest.fn((...a: unknown[]) => ({ orderBy: a })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    writeBatch: jest.fn(),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);
const snap = (docs: [string, Record<string, unknown>][]) => ({
  docs: docs.map(([id, data]) => ({ id, data: () => data })),
});

beforeEach(() => jest.clearAllMocks());

it('maps a program with safe defaults and milestones in order', () => {
  expect(
    toProgram('p', { name: ' Gala ', status: 'weird', dueAt: ts(5) }, [
      { id: 'b', name: 'B', order: 2, done: false },
      { id: 'a', name: 'A', order: 1, done: true },
    ]),
  ).toEqual({
    id: 'p',
    name: 'Gala',
    description: '',
    ownerTitle: '',
    ownerId: null,
    dueAt: new Date(5),
    status: 'not_started',
    chapterYear: '',
    milestones: [
      { id: 'a', name: 'A', order: 1, done: true },
      { id: 'b', name: 'B', order: 2, done: false },
    ],
  });
});

it('lists programs soonest due first, each with milestones', async () => {
  jest.mocked(getDocs).mockImplementation(async (ref: unknown) => {
    const path = (ref as { path: string }).path;
    if (path === 'programs') return snap([['p1', { name: 'One', status: 'in_progress' }]]) as never;
    return snap([['m1', { name: 'Step', order: 1, done: true }]]) as never;
  });
  const programs = await fetchPrograms();
  expect(orderBy).toHaveBeenCalledWith('dueAt', 'asc');
  expect(programs[0]).toMatchObject({ id: 'p1', milestones: [{ id: 'm1', done: true }] });
});

it('reads one program, or null', async () => {
  jest.mocked(getDocs).mockResolvedValue(snap([]) as never);
  jest
    .mocked(getDoc)
    .mockResolvedValueOnce({ exists: () => true, id: 'p1', data: () => ({ name: 'One' }) } as never)
    .mockResolvedValueOnce({ exists: () => false, id: 'x', data: () => ({}) } as never);
  expect(await fetchProgram('p1')).toMatchObject({ id: 'p1', name: 'One' });
  expect(await fetchProgram('x')).toBeNull();
});

it('checks a milestone off and sets the status in one write, recording who', async () => {
  const batch = { update: jest.fn(), commit: jest.fn(async () => {}) };
  jest.mocked(writeBatch).mockReturnValue(batch as never);
  await setMilestoneDone('p1', 'm2', true, 'olivia', 'completed');
  expect(batch.update).toHaveBeenCalledWith(
    { path: 'programs/p1/milestones/m2' },
    { done: true, doneAt: 'NOW', doneBy: 'olivia' },
  );
  expect(batch.update).toHaveBeenCalledWith(
    { path: 'programs/p1' },
    { status: 'completed', updatedAt: 'NOW' },
  );
  await setMilestoneDone('p1', 'm2', false, 'olivia', 'in_progress');
  expect(batch.update).toHaveBeenCalledWith(
    { path: 'programs/p1/milestones/m2' },
    { done: false, doneAt: null, doneBy: null },
  );
});
