import type { FeedAuthor, FeedPost } from '@/data/feed';
import { initiationYear } from '@/features/directory/directoryLogic';
import { roleLabel } from '@/features/roles/permissions';

/**
 * A LinkedIn-style line under the author's name: officer title, initiation year, job.
 * "Treasurer · Initiated 2019 · Software engineer", leaving out whatever is missing.
 */
export function authorLine(author: FeedAuthor): string {
  const year = initiationYear(author.initiationTerm);
  return [
    author.role ? roleLabel(author.role) : '',
    year ? `Initiated ${year}` : author.initiationTerm,
    author.headline,
  ]
    .filter(Boolean)
    .join(' · ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Just now", "5m", "3h", "2d", then "Oct 12" (with the year once it's a different year). */
export function timeAgo(date: Date, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const day = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day}, ${date.getFullYear()}`;
}

export const likesLabel = (n: number) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? 'like' : 'likes'}`;

export function commentsLabel(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? 'View 1 comment' : `View all ${n.toLocaleString('en-US')} comments`;
}

/** Drops posts by people the member blocked. Removed posts never reach the app. */
export function visiblePosts(posts: FeedPost[], blocked: ReadonlySet<string>): FeedPost[] {
  return posts.filter((p) => !blocked.has(p.authorId));
}

/** Adds a page under what's loaded, skipping any post already shown (posts can shift pages). */
export function appendPage(loaded: FeedPost[], page: FeedPost[]): FeedPost[] {
  const seen = new Set(loaded.map((p) => p.id));
  return [...loaded, ...page.filter((p) => !seen.has(p.id))];
}

/** Captions longer than this show "more". */
export const CAPTION_PREVIEW = 125;

export function captionPreview(caption: string): { text: string; truncated: boolean } {
  const trimmed = caption.trim();
  if (trimmed.length <= CAPTION_PREVIEW) return { text: trimmed, truncated: false };
  const cut = trimmed.slice(0, CAPTION_PREVIEW);
  const space = cut.lastIndexOf(' ');
  return { text: `${(space > 80 ? cut.slice(0, space) : cut).trimEnd()}…`, truncated: true };
}
