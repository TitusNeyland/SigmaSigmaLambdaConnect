import type { DirectoryEntry } from '@/data/directory';
import type { EventSummary } from '@/data/events';
import { LIMITS } from '@/data/types';

export const MAX_CAPTION = LIMITS.caption;
/** Matches the rules' cap on tagged members. */
export const MAX_TAGS = 20;

/** Tag events from the last month or the next two, the ones a photo is likely from. */
export const TAG_EVENT_PAST_DAYS = 30;
export const TAG_EVENT_FUTURE_DAYS = 60;

/** A post needs at least one photo or some words. The rules require the same. */
export function canShare(photoCount: number, caption: string): boolean {
  return photoCount > 0 || caption.trim().length > 0;
}

/** Events to offer for tagging: closest to now first, cancelled ones left out. */
export function taggableEvents(events: EventSummary[], now: Date): EventSummary[] {
  return events
    .filter((e) => !e.cancelled)
    .sort(
      (a, b) =>
        Math.abs(a.startsAt.getTime() - now.getTime()) -
        Math.abs(b.startsAt.getTime() - now.getTime()),
    );
}

/** Brothers to offer for tagging: not yourself, matching the search, A to Z. */
export function taggableBrothers(
  entries: DirectoryEntry[],
  me: string,
  search: string,
): DirectoryEntry[] {
  const q = search.trim().toLowerCase();
  return entries
    .filter((e) => e.uid !== me)
    .filter((e) => !q || e.displayName.toLowerCase().includes(q))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Adds or removes a tag, never going past the cap. */
export function toggleTag(tags: string[], uid: string): string[] {
  if (tags.includes(uid)) return tags.filter((t) => t !== uid);
  return tags.length >= MAX_TAGS ? tags : [...tags, uid];
}

/** "Marcus Reed", "Marcus Reed and Chris Baptiste", "Marcus Reed and 2 others". */
export function tagSummary(names: string[]): string {
  if (names.length === 0) return 'None';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}
