import type { ActivityItem, ActivityType } from '@/data/activity';
import { formatDay, formatTime } from '@/features/events/eventsLogic';

export type ActivityActor = { id: string; name: string; photoURL: string | null };

/** One row in Activity. Likes on the same post are grouped, like Instagram. */
export type ActivityRow = {
  key: string;
  type: ActivityType;
  /** Newest first, each person once. Empty for the chapter's own notices. */
  actors: ActivityActor[];
  postId: string | null;
  eventId: string | null;
  announcementId: string | null;
  title: string;
  startsAt: Date | null;
  text: string;
  photoPath: string | null;
  /** The newest item in the row. */
  at: Date;
};

export type ActivitySection = { title: 'New' | 'Earlier'; rows: ActivityRow[] };

const isNew = (item: ActivityItem, seen: Date | null) =>
  seen === null || item.at.getTime() > seen.getTime();

/** True when someone (not blocked) liked or commented since the member last looked. */
export function hasNewActivity(
  items: ActivityItem[],
  seen: Date | null,
  blocked: ReadonlySet<string>,
): boolean {
  return items.some((i) => !blocked.has(i.actorId) && isNew(i, seen));
}

function toRows(items: ActivityItem[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const likes = new Map<string, ActivityRow>();
  for (const i of items) {
    const actor = { id: i.actorId, name: i.actorName, photoURL: i.actorPhotoURL };
    const grouped = i.type === 'like' && i.postId ? likes.get(i.postId) : undefined;
    if (grouped) {
      if (!grouped.actors.some((a) => a.id === actor.id)) grouped.actors.push(actor);
      continue;
    }
    const row: ActivityRow = {
      key: i.id,
      type: i.type,
      actors: i.actorId ? [actor] : [],
      postId: i.postId,
      eventId: i.eventId,
      announcementId: i.announcementId,
      title: i.title,
      startsAt: i.startsAt,
      text: i.text,
      photoPath: i.photoPath,
      at: i.at,
    };
    if (i.type === 'like' && i.postId) likes.set(i.postId, row);
    rows.push(row);
  }
  return rows;
}

/**
 * Activity in two sections: New since the member last looked, then Earlier. Items are
 * newest first. People the member blocked are left out.
 */
export function activitySections(
  items: ActivityItem[],
  seen: Date | null,
  blocked: ReadonlySet<string>,
): ActivitySection[] {
  const shown = items.filter((i) => !blocked.has(i.actorId));
  const sections: ActivitySection[] = [
    { title: 'New', rows: toRows(shown.filter((i) => isNew(i, seen))) },
    { title: 'Earlier', rows: toRows(shown.filter((i) => !isNew(i, seen))) },
  ];
  return sections.filter((s) => s.rows.length > 0);
}

/** "Sample Chris", "Sample Chris and Sample Zed", "Sample Chris and 2 others". */
export function actorNames(actors: ActivityActor[]): string {
  const [first, second] = actors;
  if (!first) return '';
  if (!second) return first.name;
  if (actors.length === 2) return `${first.name} and ${second.name}`;
  return `${first.name} and ${actors.length - 1} others`;
}

/**
 * What happened, after the names: " liked your post.", " commented: Great night". The
 * chapter's own notices have no names, so theirs read as whole sentences.
 */
export function activityAction(row: ActivityRow, now: Date): string {
  switch (row.type) {
    case 'like':
      return ' liked your post.';
    case 'comment':
      return row.text ? ` commented: ${row.text}` : ' commented on your post.';
    case 'reply':
      return row.text ? ` replied to your comment: ${row.text}` : ' replied to your comment.';
    case 'tag':
      return ' tagged you in a post.';
    case 'announcement':
      return row.actors.length
        ? ` posted an announcement: ${row.title}`
        : `New announcement: ${row.title}`;
    case 'event_reminder': {
      if (!row.startsAt) return `Reminder: ${row.title} is coming up.`;
      const day = formatDay(row.startsAt, now);
      const when = day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : `on ${day}`;
      return `Reminder: ${row.title} is ${when} at ${formatTime(row.startsAt)}.`;
    }
    case 'approved':
      return 'Welcome to Sigma Sigma Lambda Connect. An officer approved your membership.';
  }
}

/** Where tapping a row goes, or null if it doesn't go anywhere. */
export function activityTarget(
  row: ActivityRow,
):
  | { pathname: '/home/post/[id]'; params: { id: string } }
  | { pathname: '/home/comments/[id]'; params: { id: string } }
  | { pathname: '/events/[id]'; params: { id: string } }
  | { pathname: '/chapter' }
  | null {
  switch (row.type) {
    case 'like':
    case 'tag':
      return row.postId ? { pathname: '/home/post/[id]', params: { id: row.postId } } : null;
    case 'comment':
    case 'reply':
      return row.postId ? { pathname: '/home/comments/[id]', params: { id: row.postId } } : null;
    case 'event_reminder':
      return row.eventId ? { pathname: '/events/[id]', params: { id: row.eventId } } : null;
    case 'announcement':
      return { pathname: '/chapter' };
    case 'approved':
      return null;
  }
}
