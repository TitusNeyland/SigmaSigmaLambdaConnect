import type { ProgramSummary } from '@/data/programs';

import {
  addMilestone,
  blankProgramForm,
  formFromProgram,
  hasProgramErrors,
  ledBy,
  MAX_MILESTONES,
  moveMilestone,
  removeMilestone,
  toProgramInput,
  validateProgramForm,
  type ProgramForm,
} from './programForm';

const NOW = new Date(2026, 10, 6, 12);

const valid = (overrides: Partial<ProgramForm> = {}): ProgramForm => ({
  ...blankProgramForm(NOW),
  name: 'Sample food drive',
  milestones: [
    { key: 'a', name: 'Book the venue' },
    { key: 'b', name: 'Collect cans' },
  ],
  ...overrides,
});

it('starts due in about two months, with one milestone row to type in', () => {
  const form = blankProgramForm(NOW);
  expect(form.dueAt).toEqual(new Date(2027, 0, 6, 17));
  expect(form.milestones).toHaveLength(1);
  expect(form.ownerId).toBeNull();
});

it('needs a name and at least one milestone, and a future due date when new', () => {
  const errors = validateProgramForm(
    valid({ name: ' ', milestones: [{ key: 'a', name: ' ' }], dueAt: new Date(2026, 0, 1) }),
    { now: NOW, isNew: true },
  );
  expect(errors).toEqual({
    name: 'Give the program a name.',
    milestones: 'Add at least one milestone.',
    dueAt: 'Pick a due date in the future.',
  });
  // An overdue program can still be edited.
  expect(
    validateProgramForm(valid({ dueAt: new Date(2026, 0, 1) }), { now: NOW, isNew: false }).dueAt,
  ).toBeUndefined();
  expect(hasProgramErrors(validateProgramForm(valid(), { now: NOW, isNew: true }))).toBe(false);
});

it('flags overlong text, including a milestone by its row', () => {
  const errors = validateProgramForm(
    valid({
      name: 'x'.repeat(81),
      ownerTitle: 'x'.repeat(61),
      milestones: [{ key: 'long', name: 'x'.repeat(81) }],
    }),
    { now: NOW, isNew: true },
  );
  expect(errors.name).toMatch(/80/);
  expect(errors.ownerTitle).toMatch(/60/);
  expect(errors.milestoneRows).toEqual({ long: 'Keep it under 80 characters.' });
});

it('adds, removes and reorders milestones', () => {
  const rows = valid().milestones;
  expect(addMilestone(rows)).toHaveLength(3);
  expect(removeMilestone(rows, 'a').map((r) => r.key)).toEqual(['b']);
  expect(moveMilestone(rows, 'b', -1).map((r) => r.key)).toEqual(['b', 'a']);
  expect(moveMilestone(rows, 'a', -1)).toBe(rows);
  expect(moveMilestone(rows, 'b', 1)).toBe(rows);
  const full = Array.from({ length: MAX_MILESTONES }, (_, i) => ({ key: `k${i}`, name: 'x' }));
  expect(addMilestone(full)).toBe(full);
});

it('saves trimmed values, drops blank rows, and keeps saved milestones’ ids', () => {
  expect(
    toProgramInput(
      valid({
        name: ' Sample food drive ',
        ownerId: 'u1',
        ownerName: ' Sample Lead ',
        ownerTitle: ' Service committee ',
        milestones: [
          { key: 'a', id: 'm1', name: ' Book the venue ' },
          { key: 'b', name: '  ' },
          { key: 'c', name: 'Collect cans' },
        ],
      }),
    ),
  ).toMatchObject({
    name: 'Sample food drive',
    ownerId: 'u1',
    ownerName: 'Sample Lead',
    ownerTitle: 'Service committee',
    milestones: [{ id: 'm1', name: 'Book the venue' }, { name: 'Collect cans' }],
  });
  expect(toProgramInput(valid({ ownerId: null, ownerName: 'Stale' })).ownerName).toBe('');
});

it('opens an existing program with its milestones in order', () => {
  const program = {
    id: 'p1',
    name: 'Sample drive',
    description: 'Cans',
    ownerTitle: 'Service committee',
    ownerId: 'u1',
    ownerName: 'Sample Lead',
    dueAt: new Date(2027, 1, 1),
    createdAt: null,
    status: 'in_progress',
    chapterYear: '2026-27',
    milestones: [
      { id: 'm1', name: 'Book', order: 1, done: true },
      { id: 'm2', name: 'Collect', order: 2, done: false },
    ],
  } satisfies ProgramSummary;
  const form = formFromProgram(program, NOW);
  expect(form).toMatchObject({ name: 'Sample drive', ownerId: 'u1', ownerName: 'Sample Lead' });
  expect(form.milestones.map((m) => [m.id, m.name])).toEqual([
    ['m1', 'Book'],
    ['m2', 'Collect'],
  ]);
});

it('says who leads it', () => {
  expect(ledBy({ ownerName: 'Sample Lead', ownerTitle: 'Service committee' })).toBe(
    'Led by Sample Lead · Service committee',
  );
  expect(ledBy({ ownerName: '', ownerTitle: 'Director of Education' })).toBe(
    'Led by Director of Education',
  );
  expect(ledBy({ ownerName: '', ownerTitle: '' })).toBe('');
});
