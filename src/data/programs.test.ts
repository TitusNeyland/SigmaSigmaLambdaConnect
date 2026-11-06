import { getDoc, getDocs, orderBy, setDoc, Timestamp, writeBatch } from 'firebase/firestore';

import {
  createProgram,
  deleteProgram,
  fetchMyHelpOffers,
  fetchProgram,
  fetchPrograms,
  offerHelp,
  setMilestoneDone,
  setNeedsHelp,
  toProgram,
  updateProgram,
  type ProgramSummary,
} from './programs';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
let mockIds = 0;
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    mockMs: number;
    constructor(ms: number) {
      this.mockMs = ms;
    }
    toDate() {
      return new Date(this.mockMs);
    }
    static fromDate(d: Date) {
      return new MockTimestamp(d.getTime());
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((parent: { path?: string }, ...s: string[]) => ({
      path: [parent.path, ...s].filter(Boolean).join('/'),
    })),
    // doc(collectionRef) makes up a new ID, like Firestore does.
    doc: jest.fn((parent: { path?: string }, ...s: string[]) => {
      if (s.length) return { path: [parent.path, ...s].filter(Boolean).join('/') };
      const id = `new${++mockIds}`;
      return { path: `${parent.path}/${id}`, id };
    }),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ...ref, parts })),
    orderBy: jest.fn((...a: unknown[]) => ({ orderBy: a })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    writeBatch: jest.fn(),
    setDoc: jest.fn(),
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
    toProgram('p', { name: ' Gala ', status: 'weird', dueAt: ts(5), createdAt: ts(2) }, [
      { id: 'b', name: 'B', order: 2, done: false },
      { id: 'a', name: 'A', order: 1, done: true },
    ]),
  ).toEqual({
    id: 'p',
    name: 'Gala',
    description: '',
    ownerTitle: '',
    ownerId: null,
    ownerName: '',
    dueAt: new Date(5),
    createdAt: new Date(2),
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

describe('help offers', () => {
  it('offers as myself with exactly the fields the rules allow', async () => {
    jest.mocked(setDoc).mockResolvedValue(undefined);
    await offerHelp('health', 'me');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'programs/health/helpers/me' },
      { memberId: 'me', createdAt: 'NOW' },
    );
  });

  it('checks which programs I already offered on', async () => {
    jest
      .mocked(getDoc)
      .mockImplementation(
        async (ref: unknown) =>
          ({ exists: () => (ref as { path: string }).path === 'programs/a/helpers/me' }) as never,
      );
    expect(await fetchMyHelpOffers(['a', 'b'], 'me')).toEqual(new Set(['a']));
  });
});

describe('managing programs', () => {
  const batch = { set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    mockIds = 0;
    batch.commit.mockResolvedValue(undefined);
    jest.mocked(writeBatch).mockReturnValue(batch as never);
  });

  const input = {
    name: ' Sample food drive ',
    description: ' Cans for the sample pantry. ',
    ownerId: 'u-lead',
    ownerName: ' Sample Lead ',
    ownerTitle: ' Service committee ',
    dueAt: new Date(2027, 2, 1),
    milestones: [{ name: ' Book the venue ' }, { name: 'Collect cans' }],
  };
  const program = (overrides: Partial<ProgramSummary> = {}): ProgramSummary => ({
    id: 'p1',
    name: 'Old name',
    description: '',
    ownerTitle: '',
    ownerId: null,
    ownerName: '',
    dueAt: new Date(2027, 1, 1),
    createdAt: null,
    status: 'in_progress',
    chapterYear: '2026-27',
    milestones: [
      { id: 'a', name: 'Book the venue', order: 1, done: true },
      { id: 'b', name: 'Print flyers', order: 2, done: false },
    ],
    ...overrides,
  });

  it('creates the program, not started, in its chapter year, with milestones in order', async () => {
    expect(await createProgram(input, 'officer-1')).toBe('new1');
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'programs/new1', id: 'new1' },
      expect.objectContaining({
        name: 'Sample food drive',
        description: 'Cans for the sample pantry.',
        ownerId: 'u-lead',
        ownerName: 'Sample Lead',
        ownerTitle: 'Service committee',
        status: 'not_started',
        chapterYear: '2026-27',
        createdAt: 'NOW',
        createdBy: 'officer-1',
      }),
    );
    const milestones = batch.set.mock.calls.slice(1).map((c) => c[1]);
    expect(milestones).toEqual([
      { name: 'Book the venue', order: 1, done: false, doneAt: null, doneBy: null },
      { name: 'Collect cans', order: 2, done: false, doneAt: null, doneBy: null },
    ]);
    expect(batch.commit).toHaveBeenCalled();
  });

  it('with no lead, keeps no lead name', async () => {
    await createProgram({ ...input, ownerId: null }, 'officer-1');
    expect(batch.set.mock.calls[0][1]).toMatchObject({ ownerId: null, ownerName: '' });
  });

  it('edits: renames and reorders kept milestones, adds new ones, removes dropped ones', async () => {
    await updateProgram(program(), {
      ...input,
      milestones: [{ name: 'Collect cans' }, { id: 'a', name: 'Book the hall' }],
    });
    expect(batch.update).toHaveBeenCalledWith(
      { path: 'programs/p1/milestones/a' },
      { name: 'Book the hall', order: 2 },
    );
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'programs/p1/milestones/new1', id: 'new1' },
      { name: 'Collect cans', order: 1, done: false, doneAt: null, doneBy: null },
    );
    expect(batch.delete).toHaveBeenCalledWith({ path: 'programs/p1/milestones/b' });
    expect(batch.update).toHaveBeenCalledWith(
      { path: 'programs/p1' },
      expect.objectContaining({
        name: 'Sample food drive',
        status: 'in_progress',
        updatedAt: 'NOW',
      }),
    );
  });

  it('leaves unchanged milestones alone, and finishes the program when only done ones are left', async () => {
    await updateProgram(program(), { ...input, milestones: [{ id: 'a', name: 'Book the venue' }] });
    expect(batch.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: 'programs/p1/milestones/a' }),
      expect.anything(),
    );
    expect(batch.update.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'completed' });
  });

  it('keeps Needs help through an edit unless the program is done', async () => {
    await updateProgram(program({ status: 'at_risk' }), {
      ...input,
      milestones: [
        { id: 'a', name: 'Book the venue' },
        { id: 'b', name: 'Print flyers' },
      ],
    });
    expect(batch.update.mock.calls.at(-1)?.[1]).toMatchObject({ status: 'at_risk' });
  });

  it('flags a program as needing help, and clears it back to what its milestones say', async () => {
    await setNeedsHelp(program(), true);
    expect(setDoc).toHaveBeenLastCalledWith(
      { path: 'programs/p1' },
      { status: 'at_risk', updatedAt: 'NOW' },
      { merge: true },
    );
    await setNeedsHelp(program({ status: 'at_risk' }), false);
    expect(jest.mocked(setDoc).mock.calls.at(-1)?.[1]).toMatchObject({ status: 'in_progress' });
  });

  it('deletes a program with its milestones and help offers', async () => {
    jest
      .mocked(getDocs)
      .mockResolvedValueOnce({ docs: [{ ref: { path: 'programs/p1/milestones/a' } }] } as never)
      .mockResolvedValueOnce({ docs: [{ ref: { path: 'programs/p1/helpers/u2' } }] } as never);
    await deleteProgram('p1');
    expect(batch.delete.mock.calls.map((c) => c[0].path)).toEqual([
      'programs/p1/milestones/a',
      'programs/p1/helpers/u2',
      'programs/p1',
    ]);
  });
});
