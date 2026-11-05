import type { ActivityItem, ActivityType } from '@/data/activity';

export type ActivityActor = { id: string; name: string; photoURL: string | null };

/** One row in Activity. Likes on the same post are grouped, like Instagram. */
export type ActivityRow = {
  key: string;
  type: ActivityType;
  /** Newest first, each person once. */
  actors: ActivityActor[];
  postId: string;
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
    const grouped = i.type === 'like' ? likes.get(i.postId) : undefined;
    if (grouped) {
      if (!grouped.actors.some((a) => a.id === actor.id)) grouped.actors.push(actor);
      continue;
    }
    const row: ActivityRow = {
      key: i.id,
      type: i.type,
      actors: [actor],
      postId: i.postId,
      text: i.text,
      photoPath: i.photoPath,
      at: i.at,
    };
    if (i.type === 'like') likes.set(i.postId, row);
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

/** What happened, after the names: " liked your post.", " commented: Great night". */
export function activityAction(row: ActivityRow): string {
  switch (row.type) {
    case 'like':
      return ' liked your post.';
    case 'comment':
      return row.text ? ` commented: ${row.text}` : ' commented on your post.';
    case 'reply':
      return row.text ? ` replied to your comment: ${row.text}` : ' replied to your comment.';
  }
}
