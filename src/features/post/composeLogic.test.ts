import type { DirectoryEntry } from '@/data/directory';
import type { EventSummary } from '@/data/events';

import {
  canShare,
  MAX_CAPTION,
  MAX_TAGS,
  tagSummary,
  taggableBrothers,
  taggableEvents,
  toggleTag,
} from './composeLogic';

const NOW = new Date(2026, 9, 29, 12);
const event = (id: string, days: number, cancelled = false) =>
  ({ id, startsAt: new Date(NOW.getTime() + days * 86_400_000), cancelled }) as EventSummary;
const brother = (uid: string, displayName: string) => ({ uid, displayName }) as DirectoryEntry;

it('matches the app and rules limits', () => {
  expect(MAX_CAPTION).toBe(2200);
  expect(MAX_TAGS).toBe(20);
});

it('needs a photo or some words to share', () => {
  expect(canShare(0, '   ')).toBe(false);
  expect(canShare(0, 'Hi')).toBe(true);
  expect(canShare(2, '')).toBe(true);
});

it('offers events closest to now first, without cancelled ones', () => {
  expect(
    taggableEvents(
      [event('far', 20), event('off', 1, true), event('past', -2), event('next', 3)],
      NOW,
    ).map((e) => e.id),
  ).toEqual(['past', 'next', 'far']);
});

it('offers brothers A to Z, without yourself, filtered by the search', () => {
  const all = [
    brother('me', 'Me Myself'),
    brother('z', 'Zed Allen'),
    brother('c', 'Chris Baptiste'),
  ];
  expect(taggableBrothers(all, 'me', '').map((b) => b.uid)).toEqual(['c', 'z']);
  expect(taggableBrothers(all, 'me', ' zed ').map((b) => b.uid)).toEqual(['z']);
});

it('toggles tags up to the cap', () => {
  expect(toggleTag(['a'], 'b')).toEqual(['a', 'b']);
  expect(toggleTag(['a', 'b'], 'a')).toEqual(['b']);
  const full = Array.from({ length: 20 }, (_, i) => String(i));
  expect(toggleTag(full, 'x')).toBe(full);
});

it('summarizes tags', () => {
  expect(tagSummary([])).toBe('None');
  expect(tagSummary(['Marcus Reed'])).toBe('Marcus Reed');
  expect(tagSummary(['Marcus Reed', 'Chris Baptiste'])).toBe('Marcus Reed and Chris Baptiste');
  expect(tagSummary(['A', 'B', 'C'])).toBe('A and 2 others');
});
