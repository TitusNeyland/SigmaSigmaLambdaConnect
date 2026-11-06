import type { DirectoryEntry } from '@/data/directory';

import {
  brotherBusinesses,
  buildSections,
  cityKey,
  entrySubtitle,
  facetOptions,
  lineKey,
  lineMembers,
  matchesRefinements,
  NO_REFINEMENTS,
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
  industry: '',
  city: '',
  businesses: [],
  initiationTerm: '',
  initiationDate: null,
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

describe('finding brothers by what they do', () => {
  const chapter = [
    entry({
      displayName: 'Sample Reed',
      industry: 'Real estate',
      businesses: ['Sample Realty'],
      interests: ['Golf', 'golf', 'Travel'],
      initiationTerm: 'Spring 2019',
    }),
    entry({
      displayName: 'Sample Allen',
      industry: 'Law',
      interests: ['Golf'],
      initiationTerm: 'spring  2019',
    }),
    entry({
      displayName: 'Sample Baker',
      industry: 'Real estate',
      businesses: ['Baker Barbershop', 'Another Studio'],
      initiationTerm: 'Fall 2021',
    }),
    entry({ displayName: 'Sample Cole', initiationTerm: 'Fall 2010' }),
  ];
  const names = (list: DirectoryEntry[]) => list.map((e) => e.displayName);

  it('searches industry and business names too', () => {
    expect(names(chapter.filter((e) => matchesSearch(e, 'realty')))).toEqual(['Sample Reed']);
    expect(names(chapter.filter((e) => matchesSearch(e, 'law')))).toEqual(['Sample Allen']);
  });

  it('narrows by industry, interest, line and business owners, together', () => {
    const only = (refine: Partial<typeof NO_REFINEMENTS>) =>
      names(chapter.filter((e) => matchesRefinements(e, { ...NO_REFINEMENTS, ...refine })));
    expect(only({ industry: 'real estate' })).toEqual(['Sample Reed', 'Sample Baker']);
    expect(only({ interest: 'GOLF' })).toEqual(['Sample Reed', 'Sample Allen']);
    expect(only({ line: 'Spring 2019' })).toEqual(['Sample Reed', 'Sample Allen']);
    expect(only({ owners: true })).toEqual(['Sample Reed', 'Sample Baker']);
    expect(only({ industry: 'Real estate', owners: true, line: 'Fall 2021' })).toEqual([
      'Sample Baker',
    ]);
    expect(only({})).toHaveLength(4);
  });

  it('offers only choices someone in the chapter has, with counts', () => {
    expect(facetOptions(chapter, 'industry')).toEqual([
      { value: 'Real estate', count: 2 },
      { value: 'Law', count: 1 },
    ]);
    // A brother who listed Golf twice still counts once.
    expect(facetOptions(chapter, 'interest')).toEqual([
      { value: 'Golf', count: 2 },
      { value: 'Travel', count: 1 },
    ]);
    // Lines newest first, the same line counted together however it was typed.
    expect(facetOptions(chapter, 'line')).toEqual([
      { value: 'Fall 2021', count: 1 },
      { value: 'Spring 2019', count: 2 },
      { value: 'Fall 2010', count: 1 },
    ]);
  });

  it('builds sections with the refinements applied', () => {
    const sections = buildSections(chapter, {
      search: '',
      filter: 'all',
      currentYear: 2026,
      refine: { ...NO_REFINEMENTS, owners: true },
    });
    expect(sections.flatMap((s) => names(s.data))).toEqual(['Sample Baker', 'Sample Reed']);
  });

  it('lists a line’s brothers by last name', () => {
    expect(lineKey('  Spring   2019 ')).toBe('spring 2019');
    expect(names(lineMembers(chapter, 'SPRING 2019'))).toEqual(['Sample Allen', 'Sample Reed']);
  });

  it('lists every brother-owned business A to Z with its owner, searchable', () => {
    expect(brotherBusinesses(chapter).map((b) => [b.name, b.owner.displayName])).toEqual([
      ['Another Studio', 'Sample Baker'],
      ['Baker Barbershop', 'Sample Baker'],
      ['Sample Realty', 'Sample Reed'],
    ]);
    expect(brotherBusinesses(chapter, 'reed').map((b) => b.name)).toEqual(['Sample Realty']);
    expect(brotherBusinesses(chapter, 'real estate')).toHaveLength(3);
  });
});

describe('brothers near you', () => {
  const chapter = [
    entry({ displayName: 'Sample Reed', city: 'Atlanta, GA' }),
    entry({ displayName: 'Sample Allen', city: 'atlanta,ga' }),
    entry({ displayName: 'Sample Baker', city: 'Houston, TX' }),
    entry({ displayName: 'Sample Cole' }),
  ];
  const names = (list: DirectoryEntry[]) => list.map((e) => e.displayName);

  it('treats the same city typed differently as one place', () => {
    expect(cityKey(' Atlanta ,GA ')).toBe('atlanta, ga');
    expect(cityKey('atlanta,  ga')).toBe(cityKey('Atlanta, GA'));
  });

  it('narrows to one city, and search finds a city too', () => {
    expect(
      names(
        chapter.filter((e) => matchesRefinements(e, { ...NO_REFINEMENTS, city: 'Atlanta, GA' })),
      ),
    ).toEqual(['Sample Reed', 'Sample Allen']);
    expect(names(chapter.filter((e) => matchesSearch(e, 'houston')))).toEqual(['Sample Baker']);
  });

  it('lists the cities brothers live in, most brothers first', () => {
    expect(facetOptions(chapter, 'city')).toEqual([
      { value: 'Atlanta, GA', count: 2 },
      { value: 'Houston, TX', count: 1 },
    ]);
  });
});
