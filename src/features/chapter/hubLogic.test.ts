import { sampleEntry } from '@/data/__mocks__/directory';
import { sampleProgram } from '@/data/__mocks__/programs';

import {
  hubPrograms,
  officersOf,
  programIcon,
  programMeta,
  progressSummary,
  waitingSummary,
} from './hubLogic';

describe('officersOf', () => {
  it('keeps only members with a role, admins first, then by last name', () => {
    const list = officersOf([
      sampleEntry({ uid: 'm', displayName: 'Sample Member' }),
      sampleEntry({
        uid: 'z',
        displayName: 'Ann Zane',
        role: { role: 'officer', title: 'Treasurer' },
      }),
      sampleEntry({
        uid: 'b',
        displayName: 'Cal Bell',
        role: { role: 'officer', title: 'President' },
      }),
      sampleEntry({ uid: 'a', displayName: 'Dee Young', role: { role: 'admin' } }),
    ]);
    expect(list.map((o) => o.uid)).toEqual(['a', 'b', 'z']);
  });
});

describe('progressSummary', () => {
  it('says when there are no programs', () => {
    expect(progressSummary([])).toEqual({ percent: 0, line: 'No programs yet' });
  });

  it('gives milestones done and how many programs are complete', () => {
    const summary = progressSummary([
      sampleProgram(),
      sampleProgram({ id: 'x', status: 'at_risk' }),
      sampleProgram({
        id: 'y',
        status: 'completed',
        milestones: [{ id: 'm', name: 'Done', order: 1, done: true }],
      }),
    ]);
    expect(summary).toEqual({ percent: 60, line: '1 of 3 programs complete' });
    expect(progressSummary([sampleProgram()]).line).toBe('0 of 1 program complete');
  });
});

describe('hubPrograms', () => {
  it('puts needs help first and completed last, each by due date', () => {
    const day = (n: number) => new Date(2026, 10, n);
    const list = hubPrograms([
      sampleProgram({ id: 'done', status: 'completed', dueAt: day(1) }),
      sampleProgram({ id: 'late', dueAt: day(20) }),
      sampleProgram({ id: 'soon', dueAt: day(10) }),
      sampleProgram({ id: 'help', status: 'at_risk', dueAt: day(30) }),
    ]);
    expect(list.map((p) => p.id)).toEqual(['help', 'soon', 'late', 'done']);
  });
});

describe('programMeta', () => {
  const now = new Date(2026, 10, 8);

  it('reads committee and due date', () => {
    expect(programMeta(sampleProgram({ dueAt: new Date(2026, 10, 25) }), now)).toBe(
      'Director of Education · Due Nov 25',
    );
  });

  it('falls back to the lead, and says when a program needs help', () => {
    const p = sampleProgram({
      ownerTitle: '',
      ownerName: 'Sample Lead',
      status: 'at_risk',
      dueAt: null,
    });
    expect(programMeta(p, now)).toBe('Sample Lead · No due date · Needs help');
  });
});

describe('programIcon', () => {
  it.each([
    ['Health Awareness Week', 'heart'],
    ['Community Service Days', 'hands'],
    ['Holiday Food Drive', 'food'],
    ['Brotherhood Retreat', 'people'],
    ['Sample scholarship initiative', 'book'],
    ['Voter registration', 'flag'],
  ])('%s gets %s', (name, icon) => {
    expect(programIcon(name)).toBe(icon);
  });
});

describe('waitingSummary', () => {
  it.each([
    [0, 0, 'Nothing waiting'],
    [1, 0, '1 membership request'],
    [0, 1, '1 report'],
    [3, 2, '3 membership requests · 2 reports'],
  ])('%i requests and %i reports reads "%s"', (membershipRequests, openReports, text) => {
    expect(waitingSummary({ membershipRequests, openReports })).toBe(text);
  });
});
