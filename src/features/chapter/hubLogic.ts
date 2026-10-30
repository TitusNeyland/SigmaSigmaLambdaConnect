import type { DirectoryEntry } from '@/data/directory';
import type { WaitingCounts } from '@/data/leadership';
import type { ProgramSummary } from '@/data/programs';
import { chapterPercent } from '@/features/programs/programLogic';
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

/** "62% of milestones · 1 program needs help", or that everything's on track. */
export function progressSummary(programs: ProgramSummary[]): { percent: number; line: string } {
  if (programs.length === 0) return { percent: 0, line: 'No programs yet' };
  const percent = chapterPercent(programs);
  const help = programs.filter((p) => p.status === 'at_risk').length;
  const tail =
    help === 0
      ? 'everything’s on track'
      : `${help} ${help === 1 ? 'program needs' : 'programs need'} help`;
  return { percent, line: `${percent}% of milestones done · ${tail}` };
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
