import { sampleEntry } from '@/data/__mocks__/directory';
import { sampleProgram } from '@/data/__mocks__/programs';

import { officersOf, progressSummary, waitingSummary } from './hubLogic';

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

  it('counts programs that need help', () => {
    const one = progressSummary([sampleProgram(), sampleProgram({ id: 'x', status: 'at_risk' })]);
    expect(one.percent).toBe(50);
    expect(one.line).toBe('50% of milestones done · 1 program needs help');
    const two = progressSummary([
      sampleProgram({ status: 'at_risk' }),
      sampleProgram({ id: 'x', status: 'at_risk' }),
    ]);
    expect(two.line).toMatch(/2 programs need help$/);
  });

  it('says everything is on track when nothing needs help', () => {
    expect(progressSummary([sampleProgram()]).line).toMatch(/everything’s on track$/);
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
