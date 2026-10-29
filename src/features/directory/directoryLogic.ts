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

/** Case-insensitive match on name, headline or any interest. Every word must match. */
export function matchesSearch(entry: DirectoryEntry, search: string): boolean {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [entry.displayName, entry.headline, ...entry.interests].join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export type DirectorySection = { letter: string; data: DirectoryEntry[] };

/** Filters, searches, sorts by last name and groups into A to Z sections ("#" last). */
export function buildSections(
  entries: DirectoryEntry[],
  options: { search: string; filter: DirectoryFilter; currentYear: number },
): DirectorySection[] {
  const visible = entries
    .filter((e) => matchesFilter(e, options.filter, options.currentYear))
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
