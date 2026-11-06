import type { ProgramInput, ProgramSummary } from '@/data/programs';

/**
 * The New and Edit program form. Pure, so it's easy to test. Limits match the security rules.
 */

export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 500;
export const MAX_OWNER_TITLE = 60;
export const MAX_MILESTONE = 80;
export const MAX_MILESTONES = 20;

/** A milestone row on the form. key is for the list; id is set for ones already saved. */
export type MilestoneRow = { key: string; id?: string; name: string };

export type ProgramForm = {
  name: string;
  description: string;
  ownerId: string | null;
  ownerName: string;
  ownerTitle: string;
  dueAt: Date;
  milestones: MilestoneRow[];
};

export type ProgramFormErrors = Partial<
  Record<'name' | 'description' | 'ownerTitle' | 'dueAt' | 'milestones', string>
> & { milestoneRows?: Record<string, string> };

let nextKey = 0;
const newKey = () => `row-${++nextKey}`;

/** A new program: due in about two months, with one empty milestone to start typing in. */
export function blankProgramForm(now: Date): ProgramForm {
  const due = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate(), 17);
  return {
    name: '',
    description: '',
    ownerId: null,
    ownerName: '',
    ownerTitle: '',
    dueAt: due,
    milestones: [{ key: newKey(), name: '' }],
  };
}

export function formFromProgram(program: ProgramSummary, now: Date): ProgramForm {
  return {
    name: program.name,
    description: program.description,
    ownerId: program.ownerId,
    ownerName: program.ownerName,
    ownerTitle: program.ownerTitle,
    dueAt: program.dueAt ?? blankProgramForm(now).dueAt,
    milestones: program.milestones.map((m) => ({ key: newKey(), id: m.id, name: m.name })),
  };
}

export function addMilestone(rows: MilestoneRow[]): MilestoneRow[] {
  return rows.length >= MAX_MILESTONES ? rows : [...rows, { key: newKey(), name: '' }];
}

export function removeMilestone(rows: MilestoneRow[], key: string): MilestoneRow[] {
  return rows.filter((r) => r.key !== key);
}

/** Moves a milestone up (-1) or down (+1) the list. Ends stay put. */
export function moveMilestone(rows: MilestoneRow[], key: string, by: -1 | 1): MilestoneRow[] {
  const from = rows.findIndex((r) => r.key === key);
  const to = from + by;
  if (from < 0 || to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** What's wrong, in plain words. Empty when it can be saved. */
export function validateProgramForm(
  form: ProgramForm,
  options: { now: Date; isNew: boolean },
): ProgramFormErrors {
  const errors: ProgramFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'Give the program a name.';
  else if (name.length > MAX_NAME) errors.name = `Keep it under ${MAX_NAME} characters.`;
  if (form.description.trim().length > MAX_DESCRIPTION) {
    errors.description = `Keep it under ${MAX_DESCRIPTION} characters.`;
  }
  if (form.ownerTitle.trim().length > MAX_OWNER_TITLE) {
    errors.ownerTitle = `Keep it under ${MAX_OWNER_TITLE} characters.`;
  }
  if (options.isNew && form.dueAt.getTime() <= options.now.getTime()) {
    errors.dueAt = 'Pick a due date in the future.';
  }
  // Blank rows are just dropped; a program needs at least one real step.
  const named = form.milestones.filter((m) => m.name.trim());
  if (named.length === 0) errors.milestones = 'Add at least one milestone.';
  const rows: Record<string, string> = {};
  for (const m of named) {
    if (m.name.trim().length > MAX_MILESTONE) {
      rows[m.key] = `Keep it under ${MAX_MILESTONE} characters.`;
    }
  }
  if (Object.keys(rows).length) errors.milestoneRows = rows;
  return errors;
}

export const hasProgramErrors = (errors: ProgramFormErrors) => Object.keys(errors).length > 0;

/** The trimmed values to save, leaving out blank milestone rows. */
export function toProgramInput(form: ProgramForm): ProgramInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    ownerId: form.ownerId,
    ownerName: form.ownerId ? form.ownerName.trim() : '',
    ownerTitle: form.ownerTitle.trim(),
    dueAt: form.dueAt,
    milestones: form.milestones
      .filter((m) => m.name.trim())
      .map((m) => ({ ...(m.id ? { id: m.id } : {}), name: m.name.trim() })),
  };
}

/** "Led by Sample Reed · Service committee", or whatever part there is. */
export function ledBy(program: Pick<ProgramSummary, 'ownerName' | 'ownerTitle'>): string {
  const who = [program.ownerName.trim(), program.ownerTitle.trim()].filter(Boolean).join(' · ');
  return who ? `Led by ${who}` : '';
}
