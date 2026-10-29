import type { DirectoryEntry } from '@/data/directory';

import {
  buildSections,
  entrySubtitle,
  initiationYear,
  isMentor,
  lastNameKey,
  matchesFilter,
  matchesSearch,
  sectionLetter,
} from './directoryLogic';

const entry = (overrides: Partial<DirectoryEntry>): DirectoryEntry => ({
  uid: overrides.displayName ?? 'x',
  displayName: 'Sample Brother',
  headline: '',
  initiationTerm: '',
  interests: [],
  photoURL: null,
  role: null,
  ...overrides,
});

describe('sorting and sections', () => {
  it.each([
    ['Marcus Reed', 'reed marcus'],
    ['  Jordan  A.  Hill ', 'hill jordan a.'],
    ['Prince', 'prince'],
    ['', ''],
  ])('lastNameKey(%j) is %j', (name, key) => expect(lastNameKey(name)).toBe(key));

  it('groups by the first letter of the last name, and anything else under #', () => {
    expect(sectionLetter('Marcus Reed')).toBe('R');
    expect(sectionLetter('marcus reed')).toBe('R');
    expect(sectionLetter('Sam 3rd')).toBe('#');
    expect(sectionLetter('Élan Óscar')).toBe('#');
  });

  it('sorts A to Z by last name, then first name, with # last', () => {
    const sections = buildSections(
      [
        entry({ displayName: 'Tony Reed' }),
        entry({ displayName: 'Adam Reed' }),
        entry({ displayName: 'Zed Allen' }),
        entry({ displayName: 'Sam 3rd' }),
        entry({ displayName: 'Chris Baptiste' }),
      ],
      { search: '', filter: 'all', currentYear: 2026 },
    );
    expect(sections.map((s) => s.letter)).toEqual(['A', 'B', 'R', '#']);
    expect(sections[2].data.map((e) => e.displayName)).toEqual(['Adam Reed', 'Tony Reed']);
  });

  it('returns no sections when nothing matches', () => {
    expect(
      buildSections([entry({ displayName: 'Tony Reed' })], {
        search: 'zzz',
        filter: 'all',
        currentYear: 2026,
      }),
    ).toEqual([]);
  });
});

describe('search', () => {
  const marcus = entry({
    displayName: 'Marcus Reed',
    headline: 'Software engineer at a bank',
    interests: ['Golf', 'Career mentoring'],
  });

  it.each(['', '  ', 'marcus', 'REED', 'engineer', 'golf', 'bank golf', 'ment'])(
    'matches %j',
    (q) => expect(matchesSearch(marcus, q)).toBe(true),
  );

  it.each(['nurse', 'marcus nurse'])('does not match %j', (q) =>
    expect(matchesSearch(marcus, q)).toBe(false),
  );
});

describe('filters', () => {
  it('officers are members with a role', () => {
    expect(matchesFilter(entry({ role: { role: 'officer' } }), 'officers', 2026)).toBe(true);
    expect(matchesFilter(entry({ role: { role: 'admin' } }), 'officers', 2026)).toBe(true);
    expect(matchesFilter(entry({}), 'officers', 2026)).toBe(false);
  });

  it('mentors mention mentoring in their headline or interests', () => {
    expect(isMentor(entry({ headline: 'Mentor and engineer' }))).toBe(true);
    expect(isMentor(entry({ interests: ['Career mentoring'] }))).toBe(true);
    expect(isMentor(entry({ headline: 'Engineer', interests: ['Golf'] }))).toBe(false);
  });

  it('recent initiates crossed in the last three years', () => {
    const at = (term: string) => matchesFilter(entry({ initiationTerm: term }), 'recent', 2026);
    expect(at('Fall 2026')).toBe(true);
    expect(at('Spring 2024')).toBe(true);
    expect(at('Spring 2023')).toBe(false);
    expect(at('Unknown')).toBe(false);
  });

  it('all matches everyone', () => {
    expect(matchesFilter(entry({}), 'all', 2026)).toBe(true);
  });

  it('applies filter and search together', () => {
    const sections = buildSections(
      [
        entry({ displayName: 'Tony Reed', role: { role: 'officer', title: 'Treasurer' } }),
        entry({ displayName: 'Adam Reed' }),
        entry({ displayName: 'Zed Allen', role: { role: 'officer' } }),
      ],
      { search: 'reed', filter: 'officers', currentYear: 2026 },
    );
    expect(sections.flatMap((s) => s.data.map((e) => e.displayName))).toEqual(['Tony Reed']);
  });
});

describe('details', () => {
  it.each([
    ['Spring 2019', 2019],
    ['Fall 1998 line', 1998],
    ['Spring', null],
    ['12019', null],
  ])('initiationYear(%j) is %j', (term, year) => expect(initiationYear(term)).toBe(year));

  it('builds a subtitle from whatever is filled in', () => {
    expect(entrySubtitle(entry({ headline: 'Engineer', initiationTerm: 'Spring 2019' }))).toBe(
      'Engineer · Initiated Spring 2019',
    );
    expect(entrySubtitle(entry({ initiationTerm: 'Spring 2019' }))).toBe('Initiated Spring 2019');
    expect(entrySubtitle(entry({}))).toBe('');
  });
});
