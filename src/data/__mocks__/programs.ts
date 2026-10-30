/** Test double for src/data/programs.ts. Use with `jest.mock('@/data/programs')`. */
import type { ProgramSummary } from '../programs';

let programs: ProgramSummary[] = [];
let failing = false;

export function sampleProgram(overrides: Partial<ProgramSummary> = {}): ProgramSummary {
  return {
    id: 'sample-scholarship',
    name: 'Sample scholarship initiative',
    description: '',
    ownerTitle: 'Director of Education',
    ownerId: null,
    dueAt: new Date(Date.now() + 30 * 86_400_000),
    status: 'in_progress',
    chapterYear: '2026-27',
    milestones: [
      { id: 'm1', name: 'Form committee', order: 1, done: true },
      { id: 'm2', name: 'Open applications', order: 2, done: false },
    ],
    ...overrides,
  };
}

export function failProgramsLoad() {
  failing = true;
}

const maybeFail = () => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
};

export const fetchPrograms = jest.fn(async () => {
  maybeFail();
  return programs;
});

export const fetchProgram = jest.fn(async (id: string) => {
  maybeFail();
  return programs.find((p) => p.id === id) ?? null;
});

export const setMilestoneDone = jest.fn(
  async (_p: string, _m: string, _done: boolean, _uid: string, _status: string) => {},
);

export function resetProgramsMock(initial: ProgramSummary[] = []) {
  programs = initial;
  failing = false;
  fetchPrograms.mockClear();
  fetchProgram.mockClear();
  setMilestoneDone.mockReset().mockResolvedValue(undefined);
}
