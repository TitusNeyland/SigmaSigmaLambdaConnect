import type { ReportAction, ReportCase } from '@/data/moderation';
import { REPORT_REASONS } from '@/data/types';

const LABELS = new Map(REPORT_REASONS.map((r) => [r.value, r.label]));

/** "Spam ×2" */
export const reasonLabel = (r: ReportCase['reasons'][number]) =>
  `${LABELS.get(r.reason) ?? 'Something else'}${r.count > 1 ? ` ×${r.count}` : ''}`;

export const countLabel = (n: number) => `${n} ${n === 1 ? 'report' : 'reports'}`;

export function kindLabel(c: ReportCase): string {
  return c.targetType === 'post' ? 'Post' : c.targetType === 'comment' ? 'Comment' : 'Member';
}

export function authorLine(c: ReportCase): string {
  return c.targetType === 'post'
    ? `Posted by ${c.authorName}`
    : c.targetType === 'comment'
      ? `Comment by ${c.authorName}`
      : `${c.authorName} was reported`;
}

/** Which buttons a card gets. A member can't be removed, only restricted. */
export function actionsFor(c: ReportCase): ReportAction[] {
  return c.targetType === 'member' ? ['kept', 'restricted'] : ['kept', 'removed', 'restricted'];
}

/** What the card says once an officer has decided. */
export function doneLabel(action: ReportAction, c: ReportCase, restrictDays: number): string {
  const tail = 'Reporters were told.';
  if (action === 'kept') return `Kept. ${tail}`;
  if (action === 'removed') return `${kindLabel(c)} removed. ${tail}`;
  return `${c.authorName} can’t post or comment for ${restrictDays} days. ${tail}`;
}

export const ACTION_TITLES: Record<ReportAction, string> = {
  kept: 'Keep',
  removed: 'Remove',
  restricted: 'Restrict',
};
