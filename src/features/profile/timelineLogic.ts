import type { EventSummary } from '@/data/events';
import type { ActivityItem, ProfilePost } from '@/data/profile';
import { inYear } from '@/features/feed/anniversaryLogic';

/** One row in a profile's Activity tab. */
export type TimelineItem =
  | { kind: 'going'; key: string; at: Date; eventId: string; title: string; location: string }
  | {
      kind: 'attended';
      key: string;
      at: Date | null;
      eventId: string;
      title: string;
      location: string;
      serviceHours: number;
    }
  | { kind: 'posted'; key: string; at: Date | null; postId: string; caption: string }
  | { kind: 'tagged'; key: string; at: Date | null; postId: string; caption: string; by: string }
  /** The day they crossed (years 0) and each line anniversary since. */
  | { kind: 'initiated'; key: string; at: Date; years: number };

export type Timeline = { upcoming: TimelineItem[]; recent: TimelineItem[] };

/** The most past items a profile lists. */
export const MAX_RECENT = 50;

const newestFirst = (a: TimelineItem, b: TimelineItem) =>
  (b.at?.getTime() ?? -Infinity) - (a.at?.getTime() ?? -Infinity);

/**
 * Everything a brother has been up to, for his profile: events coming up that he's going
 * to, soonest first, then what he's done, newest first. Check-ins are null when the viewer
 * isn't allowed to see them (only the brother and officers are).
 */
export function buildTimeline({
  attended,
  posts,
  tagged,
  upcoming,
  initiationDate,
  now,
}: {
  attended: ActivityItem[] | null;
  posts: ProfilePost[];
  tagged: ProfilePost[];
  upcoming: EventSummary[];
  initiationDate: Date | null;
  now: Date;
}): Timeline {
  const checkedIn = new Set((attended ?? []).map((a) => a.eventId));
  const going: TimelineItem[] = upcoming
    // Already checked in (an event under way) shows under Recent instead.
    .filter((e) => e.myRsvp === 'going' && !e.cancelled && !checkedIn.has(e.id))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((e) => ({
      kind: 'going',
      key: `going-${e.id}`,
      at: e.startsAt,
      eventId: e.id,
      title: e.title,
      location: e.location,
    }));

  const recent: TimelineItem[] = [
    ...(attended ?? []).map((a): TimelineItem => ({
      kind: 'attended',
      key: `attended-${a.eventId}`,
      at: a.startsAt,
      eventId: a.eventId,
      title: a.title,
      location: a.location,
      serviceHours: a.serviceHours,
    })),
    ...posts.map((p): TimelineItem => ({
      kind: 'posted',
      key: `posted-${p.id}`,
      at: p.createdAt,
      postId: p.id,
      caption: p.caption.trim(),
    })),
    ...tagged.map((p): TimelineItem => ({
      kind: 'tagged',
      key: `tagged-${p.id}`,
      at: p.createdAt,
      postId: p.id,
      caption: p.caption.trim(),
      by: p.author?.displayName ?? '',
    })),
    ...initiations(initiationDate, now),
  ].sort(newestFirst);

  return { upcoming: going, recent: recent.slice(0, MAX_RECENT) };
}

/** The day he crossed and every line anniversary up to today. */
function initiations(crossed: Date | null, now: Date): TimelineItem[] {
  if (!crossed || crossed > now) return [];
  const items: TimelineItem[] = [];
  for (let years = 0; ; years++) {
    const at = years === 0 ? crossed : inYear(crossed, crossed.getFullYear() + years);
    if (at > now) break;
    items.push({ kind: 'initiated', key: `initiated-${years}`, at, years });
  }
  return items;
}
