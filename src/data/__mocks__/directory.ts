/**
 * Test double for src/data/directory.ts. Use with `jest.mock('@/data/directory')`, then set
 * the members with `resetDirectoryMock`.
 */
import type { DirectoryEntry } from '../directory';

let entries: DirectoryEntry[] = [];
let failing = false;

export function sampleEntry(overrides: Partial<DirectoryEntry> = {}): DirectoryEntry {
  return {
    uid: 'sample-marcus',
    displayName: 'Marcus Reed',
    headline: 'Software engineer',
    initiationTerm: 'Spring 2019',
    interests: ['Tech'],
    photoURL: null,
    role: null,
    ...overrides,
  };
}

export function failDirectoryLoad() {
  failing = true;
}

export const fetchDirectory = jest.fn(async () => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  return entries;
});

export function resetDirectoryMock(initial: DirectoryEntry[] = []) {
  entries = initial;
  failing = false;
  fetchDirectory.mockClear();
}
