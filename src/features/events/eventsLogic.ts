import type { EventSummary } from '@/data/events';
import type { EventCategory, RsvpStatus } from '@/data/types';

export type CategoryFilter = 'all' | EventCategory;

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  meeting: 'Meeting',
  service: 'Service',
  learning: 'Learning',
  brotherhood: 'Brotherhood',
  fundraiser: 'Fundraiser',
  social: 'Social',
  public: 'Public',
};

export const CATEGORY_FILTERS: readonly { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'service', label: 'Service' },
  { value: 'learning', label: 'Learning' },
  { value: 'brotherhood', label: 'Brotherhood' },
  { value: 'fundraiser', label: 'Fundraisers' },
  { value: 'social', label: 'Social' },
  { value: 'public', label: 'Public' },
];

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: 'Going',
  maybe: 'Maybe',
  not_going: 'Can’t go',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "7:00 PM", "12:30 PM". Device time zone. */
export function formatTime(date: Date): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Today", "Tomorrow", or "Sat, Nov 7". */
export function formatDay(date: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Month and day for the date block on a row: { month: 'NOV', day: '7' }. */
export function dateBlock(date: Date): { month: string; day: string } {
  return { month: MONTHS[date.getMonth()].toUpperCase(), day: String(date.getDate()) };
}

/** "Sat, Nov 7 · 7:00 PM · Chapter house", leaving out a missing place. */
export function eventMeta(event: EventSummary, now: Date): string {
  return [formatDay(event.startsAt, now), formatTime(event.startsAt), event.location]
    .filter(Boolean)
    .join(' · ');
}

/** Case-insensitive match on title, place or description. Every word must match. */
export function matchesSearch(event: EventSummary, search: string): boolean {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [event.title, event.location, event.description].join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/**
 * Applies the category and search, then splits off the featured event: the soonest one
 * that isn't cancelled. Everything else stays in date order.
 */
export function arrangeEvents(
  events: EventSummary[],
  options: { category: CategoryFilter; search: string },
): { featured: EventSummary | null; rest: EventSummary[] } {
  const visible = events
    .filter((e) => options.category === 'all' || e.category === options.category)
    .filter((e) => matchesSearch(e, options.search))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const featured = visible.find((e) => !e.cancelled) ?? null;
  return { featured, rest: visible.filter((e) => e !== featured) };
}

export function emptyMessage(category: CategoryFilter, search: string): string {
  if (search.trim()) return 'No events match your search.';
  if (category === 'all') return 'Nothing on the calendar yet. Check back soon.';
  return `No ${CATEGORY_LABELS[category].toLowerCase()} events coming up.`;
}

/** "Free", "$25" or "$12.50". */
export function formatFee(cents: number): string {
  if (cents <= 0) return 'Free';
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** "7:00 to 10:00 PM", "11:00 AM to 2:00 PM", or just the start when there's no end. */
export function formatTimeRange(start: Date, end: Date | null): string {
  if (!end || end.getTime() <= start.getTime()) return formatTime(start);
  const a = formatTime(start);
  const b = formatTime(end);
  const sameHalf = a.slice(-2) === b.slice(-2);
  const sameDay = start.toDateString() === end.toDateString();
  if (!sameDay) return `${a} to ${formatDay(end, start)}, ${b}`;
  return `${sameHalf ? a.slice(0, -3) : a} to ${b}`;
}

/** "RSVP by Fri, Nov 6, 7:00 PM", or that RSVPs are closed. */
export function deadlineText(deadline: Date | null, now: Date): string {
  if (!deadline) return 'No deadline';
  if (deadline.getTime() <= now.getTime()) return 'RSVPs are closed';
  return `${formatDay(deadline, now)}, ${formatTime(deadline)}`;
}

/** "Marcus Reed is going", "Marcus Reed, Chris Baptiste and 3 others are going". */
export function goingSummary(count: number, names: string[]): string {
  if (count <= 0) return 'No one has said they’re going yet.';
  const shown = names.slice(0, Math.min(2, count));
  const others = count - shown.length;
  if (shown.length === 0) return `${count} ${count === 1 ? 'brother is' : 'brothers are'} going`;
  if (others === 0) {
    return shown.length === 1 ? `${shown[0]} is going` : `${shown[0]} and ${shown[1]} are going`;
  }
  return `${shown.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'} are going`;
}
