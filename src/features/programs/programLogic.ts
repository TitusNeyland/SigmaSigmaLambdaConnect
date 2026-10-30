import type { ProgramMilestone, ProgramSummary } from '@/data/programs';
import type { ProgressStatus } from '@/data/types';

/** Percent complete: finished milestones over all of them, rounded. 0 with no milestones. */
export function percentDone(milestones: ProgramMilestone[]): number {
  if (milestones.length === 0) return 0;
  return Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
}

/**
 * The status after a milestone changes. All done is completed. Some done moves a program
 * out of not started. At risk is the officers' call, so it stays unless the program finishes.
 */
export function statusAfter(
  current: ProgressStatus,
  milestones: ProgramMilestone[],
): ProgressStatus {
  const done = milestones.filter((m) => m.done).length;
  if (milestones.length > 0 && done === milestones.length) return 'completed';
  if (current === 'completed') return done === 0 ? 'not_started' : 'in_progress';
  if (current === 'not_started' && done > 0) return 'in_progress';
  if (current === 'in_progress' && done === 0) return 'not_started';
  return current;
}

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: 'Not started',
  in_progress: 'On track',
  at_risk: 'Needs help',
  completed: 'Completed',
};

/** Overall progress across programs: all milestones done over all milestones. */
export function chapterPercent(programs: ProgramSummary[]): number {
  return percentDone(programs.flatMap((p) => p.milestones));
}

/** "Due Nov 7", "Due today", "3 days late". */
export function dueLabel(due: Date | null, now: Date, status: ProgressStatus): string {
  if (!due) return 'No due date';
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(due) - day(now)) / 86_400_000);
  if (status !== 'completed' && days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} late`;
  if (days === 0) return 'Due today';
  const date = `${MONTHS[due.getMonth()]} ${due.getDate()}`;
  return status === 'completed' ? `Was due ${date}` : `Due ${date}`;
}

export type ProgramGroup = {
  key: 'help' | 'track' | 'done';
  title: string;
  programs: ProgramSummary[];
};

/**
 * The member view's sections: needs help first (at risk), then on track (in progress and
 * not started), then completed. Each in due-date order. Empty sections are left out.
 */
export function groupPrograms(programs: ProgramSummary[]): ProgramGroup[] {
  const byDue = (a: ProgramSummary, b: ProgramSummary) =>
    (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity);
  const groups: ProgramGroup[] = [
    { key: 'help', title: 'Needs help', programs: programs.filter((p) => p.status === 'at_risk') },
    {
      key: 'track',
      title: 'On track',
      programs: programs.filter((p) => p.status === 'in_progress' || p.status === 'not_started'),
    },
    { key: 'done', title: 'Completed', programs: programs.filter((p) => p.status === 'completed') },
  ];
  return groups
    .map((g) => ({ ...g, programs: [...g.programs].sort(byDue) }))
    .filter((g) => g.programs.length > 0);
}
