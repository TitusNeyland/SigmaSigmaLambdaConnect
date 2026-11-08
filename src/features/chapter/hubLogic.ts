import type { DirectoryEntry } from '@/data/directory';
import type { WaitingCounts } from '@/data/leadership';
import type { ProgramSummary } from '@/data/programs';
import {
  chapterPercent,
  dueLabel,
  groupPrograms,
  STATUS_LABELS,
} from '@/features/programs/programLogic';
import { lastNameKey } from '@/features/directory/directoryLogic';

/** Officers and admins for the officers row: admins first, then by last name. */
export function officersOf(
  entries: DirectoryEntry[],
): (DirectoryEntry & { role: NonNullable<DirectoryEntry['role']> })[] {
  return entries
    .filter(
      (e): e is DirectoryEntry & { role: NonNullable<DirectoryEntry['role']> } => e.role !== null,
    )
    .sort(
      (a, b) =>
        Number(b.role.role === 'admin') - Number(a.role.role === 'admin') ||
        lastNameKey(a.displayName).localeCompare(lastNameKey(b.displayName)),
    );
}

/** The progress card: milestones done across programs, and "1 of 7 programs complete". */
export function progressSummary(programs: ProgramSummary[]): { percent: number; line: string } {
  if (programs.length === 0) return { percent: 0, line: 'No programs yet' };
  const done = programs.filter((p) => p.status === 'completed').length;
  return {
    percent: chapterPercent(programs),
    line: `${done} of ${programs.length} ${programs.length === 1 ? 'program' : 'programs'} complete`,
  };
}

/** Programs on the hub: needs help first, then on track, then completed, each by due date. */
export function hubPrograms(programs: ProgramSummary[]): ProgramSummary[] {
  return groupPrograms(programs).flatMap((g) => g.programs);
}

/** "Health committee · Due Nov 25", plus "Needs help" when it does. */
export function programMeta(program: ProgramSummary, now: Date): string {
  return [
    program.ownerTitle || program.ownerName,
    dueLabel(program.dueAt, now, program.status),
    program.status === 'at_risk' ? STATUS_LABELS.at_risk : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export type ProgramIcon = 'heart' | 'hands' | 'food' | 'people' | 'book' | 'flag';

const PROGRAM_ICONS: [RegExp, ProgramIcon][] = [
  [/food|meal|pantry|thanksgiving/, 'food'],
  [/health|wellness|fitness|blood|walk|run/, 'heart'],
  [/service|community|volunteer|clean/, 'hands'],
  [/brother|retreat|fellowship|social|bond/, 'people'],
  [/scholar|education|mentor|tutor|school|book|read|college/, 'book'],
];

/** An icon that fits the program's name, so the list is easy to scan. A flag otherwise. */
export function programIcon(name: string): ProgramIcon {
  const lower = name.toLowerCase();
  return PROGRAM_ICONS.find(([pattern]) => pattern.test(lower))?.[1] ?? 'flag';
}

/** "2 membership requests · 1 report", or "Nothing waiting". */
export function waitingSummary({ membershipRequests, openReports }: WaitingCounts): string {
  const parts = [
    membershipRequests
      ? `${membershipRequests} membership ${membershipRequests === 1 ? 'request' : 'requests'}`
      : '',
    openReports ? `${openReports} ${openReports === 1 ? 'report' : 'reports'}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Nothing waiting';
}
