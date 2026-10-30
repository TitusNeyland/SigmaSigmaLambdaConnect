import type { ProgramMilestone, ProgramSummary } from '@/data/programs';

import { chapterPercent, dueLabel, groupPrograms, percentDone, statusAfter } from './programLogic';

const ms = (...done: boolean[]): ProgramMilestone[] =>
  done.map((d, i) => ({ id: `m${i}`, name: `M${i}`, order: i, done: d }));

describe('percentDone', () => {
  it('is finished milestones over all of them', () => {
    expect(percentDone(ms(true, true, true, false))).toBe(75);
    expect(percentDone(ms(true, false, false))).toBe(33);
    expect(percentDone(ms(true))).toBe(100);
    expect(percentDone([])).toBe(0);
  });

  it('adds up across programs for the chapter', () => {
    expect(
      chapterPercent([
        { milestones: ms(true, true) },
        { milestones: ms(false, false) },
      ] as ProgramSummary[]),
    ).toBe(50);
  });
});

describe('statusAfter', () => {
  it.each([
    ['not_started', ms(true, false), 'in_progress'],
    ['in_progress', ms(true, true), 'completed'],
    ['at_risk', ms(true, true), 'completed'],
    ['at_risk', ms(true, false), 'at_risk'],
    ['completed', ms(true, false), 'in_progress'],
    ['completed', ms(false, false), 'not_started'],
    ['in_progress', ms(false, false), 'not_started'],
    ['not_started', [], 'not_started'],
  ] as const)('%s with %j becomes %s', (current, milestones, expected) =>
    expect(statusAfter(current, [...milestones])).toBe(expected),
  );
});

describe('dueLabel', () => {
  const NOW = new Date(2026, 9, 29, 12);
  it('reads naturally', () => {
    expect(dueLabel(new Date(2026, 10, 7), NOW, 'in_progress')).toBe('Due Nov 7');
    expect(dueLabel(new Date(2026, 9, 29, 20), NOW, 'in_progress')).toBe('Due today');
    expect(dueLabel(new Date(2026, 9, 26), NOW, 'at_risk')).toBe('3 days late');
    expect(dueLabel(new Date(2026, 9, 28), NOW, 'in_progress')).toBe('1 day late');
    expect(dueLabel(new Date(2026, 9, 1), NOW, 'completed')).toBe('Was due Oct 1');
    expect(dueLabel(null, NOW, 'in_progress')).toBe('No due date');
  });
});

describe('groupPrograms', () => {
  const p = (id: string, status: ProgramSummary['status'], due: number | null) =>
    ({
      id,
      status,
      dueAt: due === null ? null : new Date(due),
      milestones: [],
    }) as unknown as ProgramSummary;

  it('puts needs help first, then on track, then completed, each by due date', () => {
    const groups = groupPrograms([
      p('done', 'completed', 1),
      p('later', 'in_progress', 30),
      p('help', 'at_risk', 20),
      p('soon', 'not_started', 10),
      p('undated', 'in_progress', null),
    ]);
    expect(groups.map((g) => [g.title, g.programs.map((x) => x.id)])).toEqual([
      ['Needs help', ['help']],
      ['On track', ['soon', 'later', 'undated']],
      ['Completed', ['done']],
    ]);
  });

  it('leaves out empty groups', () => {
    expect(groupPrograms([p('a', 'completed', 1)]).map((g) => g.key)).toEqual(['done']);
  });
});
