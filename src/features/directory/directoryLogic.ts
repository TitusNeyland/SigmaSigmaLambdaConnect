import type { DirectoryEntry } from '@/data/directory';

export type DirectoryFilter = 'all' | 'officers' | 'mentors' | 'recent';

export const FILTERS: readonly { value: DirectoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'officers', label: 'Officers' },
  { value: 'mentors', label: 'Mentors' },
  { value: 'recent', label: 'Recent initiates' },
];

/** Initiated within this many years counts as a recent initiate. */
export const RECENT_YEARS = 3;

/** Sort key: last name, then first name, case-insensitive. "Marcus Reed" -> "reed marcus". */
export function lastNameKey(name: string): string {
  const words = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? '';
  return `${words[words.length - 1]} ${words.slice(0, -1).join(' ')}`;
}

/** The A to Z section a member goes under. Anything not a letter goes under "#". */
export function sectionLetter(name: string): string {
  const first = lastNameKey(name).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

/** First four-digit year in a term like "Spring 2019", or null. */
export function initiationYear(term: string): number | null {
  const match = term.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

/** Members who mention mentoring in their headline or interests. */
export function isMentor(entry: DirectoryEntry): boolean {
  return [entry.headline, ...entry.interests].some((t) => /mentor/i.test(t));
}

export function matchesFilter(
  entry: DirectoryEntry,
  filter: DirectoryFilter,
  currentYear: number,
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'officers':
      return entry.role !== null;
    case 'mentors':
      return isMentor(entry);
    case 'recent': {
      const year = initiationYear(entry.initiationTerm);
      return year !== null && year >= currentYear - (RECENT_YEARS - 1);
    }
  }
}

/**
 * Case-insensitive match on name, headline, industry, city, businesses or any interest.
 * Every word must match.
 */
export function matchesSearch(entry: DirectoryEntry, search: string): boolean {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [
    entry.displayName,
    entry.headline,
    entry.industry,
    entry.city,
    ...entry.businesses,
    ...entry.interests,
  ]
    .join(' ')
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Narrowing the directory further: one industry, interest, line or city, or business owners. */
export type Refinements = {
  industry: string | null;
  interest: string | null;
  line: string | null;
  city: string | null;
  owners: boolean;
};

export const NO_REFINEMENTS: Refinements = {
  industry: null,
  interest: null,
  line: null,
  city: null,
  owners: false,
};

/**
 * "atlanta, ga", so "Atlanta, GA" and "atlanta,ga" are the same place. Only what brothers
 * typed: there's no map, so "Atlanta" and "Atlanta, GA" stay two choices.
 */
export const cityKey = (city: string) =>
  city
    .trim()
    .toLowerCase()
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ');

/** "spring 2019", so "Spring 2019" and "spring  2019" are the same line. */
export const lineKey = (term: string) => term.trim().replace(/\s+/g, ' ').toLowerCase();

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function matchesRefinements(entry: DirectoryEntry, r: Refinements): boolean {
  if (r.industry && !same(entry.industry, r.industry)) return false;
  if (r.interest && !entry.interests.some((i) => same(i, r.interest!))) return false;
  if (r.line && lineKey(entry.initiationTerm) !== lineKey(r.line)) return false;
  if (r.city && cityKey(entry.city) !== cityKey(r.city)) return false;
  if (r.owners && entry.businesses.length === 0) return false;
  return true;
}

export type FacetOption = { value: string; count: number };

/**
 * The choices for a refinement, from who's actually in the chapter, with how many brothers
 * each has. Most brothers first; lines newest first.
 */
export function facetOptions(
  entries: DirectoryEntry[],
  facet: 'industry' | 'interest' | 'line' | 'city',
): FacetOption[] {
  const counts = new Map<string, { value: string; count: number }>();
  const add = (raw: string) => {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (!value) return;
    const key = facet === 'city' ? cityKey(value) : value.toLowerCase();
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { value, count: 1 });
  };
  for (const e of entries) {
    if (facet === 'industry') add(e.industry);
    else if (facet === 'line') add(e.initiationTerm);
    else if (facet === 'city') add(e.city);
    else {
      // Each brother counts once per interest, even if he listed it twice.
      const seen = new Set<string>();
      for (const i of e.interests) {
        const key = i.trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          add(i);
        }
      }
    }
  }
  const options = [...counts.values()];
  if (facet === 'line') {
    return options.sort(
      (a, b) =>
        (initiationYear(b.value) ?? 0) - (initiationYear(a.value) ?? 0) ||
        a.value.localeCompare(b.value),
    );
  }
  return options.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Brothers from one line, by last name. */
export function lineMembers(entries: DirectoryEntry[], term: string): DirectoryEntry[] {
  return entries
    .filter((e) => lineKey(e.initiationTerm) === lineKey(term))
    .sort((a, b) => lastNameKey(a.displayName).localeCompare(lastNameKey(b.displayName)));
}

export type OwnedBusiness = { name: string; owner: DirectoryEntry };

/** Every brother-owned business, A to Z, each with its owner. Search by business, owner or field. */
export function brotherBusinesses(entries: DirectoryEntry[], search = ''): OwnedBusiness[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries
    .flatMap((owner) => owner.businesses.map((name) => ({ name, owner })))
    .filter(({ name, owner }) => {
      const haystack = [name, owner.displayName, owner.industry].join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export type DirectorySection = { letter: string; data: DirectoryEntry[] };

/** Filters, searches, sorts by last name and groups into A to Z sections ("#" last). */
export function buildSections(
  entries: DirectoryEntry[],
  options: {
    search: string;
    filter: DirectoryFilter;
    currentYear: number;
    refine?: Refinements;
  },
): DirectorySection[] {
  const refine = options.refine ?? NO_REFINEMENTS;
  const visible = entries
    .filter((e) => matchesFilter(e, options.filter, options.currentYear))
    .filter((e) => matchesRefinements(e, refine))
    .filter((e) => matchesSearch(e, options.search))
    .sort((a, b) => lastNameKey(a.displayName).localeCompare(lastNameKey(b.displayName)));

  const sections = new Map<string, DirectoryEntry[]>();
  for (const entry of visible) {
    const letter = sectionLetter(entry.displayName);
    sections.set(letter, [...(sections.get(letter) ?? []), entry]);
  }
  return [...sections.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, data]) => ({ letter, data }));
}

/** "Software engineer · Initiated Spring 2019", leaving out whatever is missing. */
export function entrySubtitle(entry: DirectoryEntry): string {
  return [entry.headline, entry.initiationTerm && `Initiated ${entry.initiationTerm}`]
    .filter(Boolean)
    .join(' · ');
}
