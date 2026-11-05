import type { ChapterKpis } from '@/data/leadership';
import type { ProgramSummary } from '@/data/programs';
import type { GoalResult } from '@/data/types';
import { goalProgress } from '@/features/leadership/leadershipLogic';
import { chapterPercent, dueLabel } from '@/features/programs/programLogic';

/**
 * Chapter health: each program and goal gets a green, yellow or red status by comparing
 * how much is done with how much time has gone. Everything is computed from real activity
 * and the chapter's own goals, never typed in and never a national requirement.
 */
export type Health = 'green' | 'yellow' | 'red' | 'none';

/** How far behind pace, in percentage points, still counts as yellow. Beyond it is red. */
export const YELLOW_POINTS = 15;

export const HEALTH_LABEL: Record<Health, string> = {
  green: 'On track',
  yellow: 'Behind',
  red: 'At risk',
  none: 'No data yet',
};

/** Worst first, so what needs attention is at the top. */
const RANK: Record<Health, number> = { red: 0, yellow: 1, none: 2, green: 3 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const pct = (n: number) => Math.round(n * 100);

/** Share of the time gone between start and end, 0 to 1. Null without a usable span. */
export function elapsed(start: Date | null, end: Date | null, now: Date): number | null {
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  return clamp01((now.getTime() - start.getTime()) / (end.getTime() - start.getTime()));
}

/** Green when progress keeps up with the time gone, yellow up to 15 points behind, else red. */
export function paceHealth(progress: number, expected: number): Health {
  // Rounded to a tenth of a point, so 15.000000001 behind still counts as 15.
  const behind = Math.round((expected - progress) * 1000) / 10;
  if (behind <= 0) return 'green';
  return behind <= YELLOW_POINTS ? 'yellow' : 'red';
}

export type ProgramHealth = {
  id: string;
  name: string;
  /** "Health committee · Due Nov 20" */
  detail: string;
  percent: number;
  health: Health;
  label: string;
  /** Why it has this status: "Overdue", "Expected 60% by now". */
  note: string;
};

/**
 * A program's status. Done is green. Flagged as needing help, or past due, is red. Otherwise
 * the milestones done are compared with how many should be done by now, from the time gone
 * between its start and its due date: on pace is green, one milestone (or up to 15 points)
 * behind is yellow, more is red. A program without a start date is measured from the start
 * of the chapter year.
 */
export function programHealth(p: ProgramSummary, now: Date, yearStart: Date | null): ProgramHealth {
  const total = p.milestones.length;
  const done = p.milestones.filter((m) => m.done).length;
  const complete = p.status === 'completed' || (total > 0 && done === total);
  const percent = complete ? 100 : total ? pct(done / total) : 0;
  const base = {
    id: p.id,
    name: p.name,
    detail: [p.ownerTitle, dueLabel(p.dueAt, now, complete ? 'completed' : p.status)]
      .filter(Boolean)
      .join(' · '),
    percent,
  };
  const result = (health: Health, note: string, label = HEALTH_LABEL[health]) => ({
    ...base,
    health,
    label,
    note,
  });

  if (complete) return result('green', 'All milestones done', 'Done');
  if (p.status === 'at_risk') return result('red', 'Flagged as needing help');
  if (p.dueAt && p.dueAt.getTime() < now.getTime()) return result('red', 'Past its due date');
  const expected = elapsed(p.createdAt ?? yearStart, p.dueAt, now);
  if (expected === null) return result('none', p.dueAt ? 'No start date' : 'No due date');
  if (total === 0) return result('none', 'No milestones yet');
  const due = Math.floor(expected * total);
  const behind = due - done;
  const health: Health =
    behind <= 0
      ? 'green'
      : behind === 1 || (behind / total) * 100 <= YELLOW_POINTS
        ? 'yellow'
        : 'red';
  return result(health, `Expected ${due} of ${total} milestones by now`);
}

export type GoalHealth = {
  id: string;
  name: string;
  /** "210 of 500 hours" */
  progress: string;
  health: Health;
  label: string;
  note: string;
};

/**
 * A goal's status. Percent goals (participation, attendance) are a level, so they compare
 * straight to the target. Hours and counts build up over the year, so they compare to how
 * much of the target should be done by now. Custom goals are done or not.
 */
export function goalHealth(g: GoalResult, yearGone: number | null): GoalHealth {
  const base = { id: g.id, name: g.name, progress: goalProgress(g) };
  const result = (health: Health, note: string, label = HEALTH_LABEL[health]) => ({
    ...base,
    health,
    label,
    note,
  });

  if (g.met) return result('green', 'Met', 'Met');
  if (g.metric === 'custom') {
    return yearGone !== null && yearGone >= 1
      ? result('red', 'Not done by the end of the year')
      : result('none', 'Not done yet', 'Not done yet');
  }
  if (g.value === null) return result('none', 'No activity yet');
  if (g.unit === 'percent') {
    const behind = g.target - g.value;
    const health: Health = behind <= 0 ? 'green' : behind <= YELLOW_POINTS ? 'yellow' : 'red';
    return result(health, `Target ${Math.round(g.target)}%`);
  }
  if (g.target <= 0) return result('green', 'Met', 'Met');
  const expected = yearGone ?? 1;
  const due = Math.round(g.target * expected);
  return result(
    paceHealth(g.value / g.target, expected),
    `Expected ${due}${g.unit === 'hours' ? ' hours' : ''} by now`,
  );
}

export type HealthCounts = Record<Health, number>;

export function countHealth(items: { health: Health }[]): HealthCounts {
  const counts: HealthCounts = { green: 0, yellow: 0, red: 0, none: 0 };
  for (const i of items) counts[i.health] += 1;
  return counts;
}

/** "5 on track · 2 behind · 1 at risk", leaving out zeros. */
export function healthLine(counts: HealthCounts): string {
  const parts = (['green', 'yellow', 'red'] as const)
    .filter((h) => counts[h] > 0)
    .map((h) => `${counts[h]} ${HEALTH_LABEL[h].toLowerCase()}`);
  return parts.length ? parts.join(' · ') : 'Nothing to track yet';
}

export const byHealth = <T extends { health: Health }>(items: T[]): T[] =>
  [...items].sort((a, b) => RANK[a.health] - RANK[b.health]);

export type ChapterHealth = {
  programs: ProgramHealth[];
  goals: GoalHealth[];
  counts: HealthCounts;
  /** Milestones done across every program, 0 to 100. */
  programsPercent: number;
  goalsMet: number;
  goalsTotal: number;
  /** How far through the chapter year we are, 0 to 100. Null if unknown. */
  yearPercent: number | null;
};

/** Everything on the chapter health screen, worst first. */
export function chapterHealth(
  programs: ProgramSummary[],
  year: ChapterKpis | null,
  now: Date,
): ChapterHealth {
  const yearGone = elapsed(year?.start ?? null, year?.end ?? null, now);
  const ph = byHealth(programs.map((p) => programHealth(p, now, year?.start ?? null)));
  const gh = byHealth((year?.goals ?? []).map((g) => goalHealth(g, yearGone)));
  return {
    programs: ph,
    goals: gh,
    counts: countHealth([...ph, ...gh]),
    programsPercent: chapterPercent(programs),
    goalsMet: year?.goalsDone ?? 0,
    goalsTotal: year?.goalsTotal ?? 0,
    yearPercent: yearGone === null ? null : pct(yearGone),
  };
}
