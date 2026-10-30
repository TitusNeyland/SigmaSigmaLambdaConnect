import type { ChapterAnnouncement } from '@/data/announcements';

/** Pinned first, then newest first. */
export function sortAnnouncements(list: ChapterAnnouncement[]): ChapterAnnouncement[] {
  return [...list].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export function unreadCount(list: ChapterAnnouncement[], reads: ReadonlySet<string>): number {
  return list.filter((a) => !reads.has(a.id)).length;
}

export const MAX_TITLE = 100;
export const MAX_BODY = 2000;

export function canPost(title: string, body: string): boolean {
  const t = title.trim();
  const b = body.trim();
  return t.length > 0 && t.length <= MAX_TITLE && b.length > 0 && b.length <= MAX_BODY;
}
