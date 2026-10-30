import type { ChapterKpis } from '@/data/leadership';
import type { GoalResult } from '@/data/types';

export type Tile = { key: string; label: string; value: string; caption: string };

const pct = (rate: number) => `${Math.round(rate * 100)}%`;
const hours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1));

/** The four KPI tiles for one period. */
export function kpiTiles(k: ChapterKpis): Tile[] {
  const noEvents = 'No events yet';
  return [
    {
      key: 'participation',
      label: 'Participation',
      value: k.participationRate === null ? 'None' : pct(k.participationRate),
      caption: k.participationRate === null ? noEvents : 'Came to at least one event',
    },
    {
      key: 'attendance',
      label: 'Attendance',
      value: k.attendanceRate === null ? 'None' : pct(k.attendanceRate),
      caption:
        k.attendanceRate === null
          ? noEvents
          : `Average per event · ${k.eventsHeld} ${k.eventsHeld === 1 ? 'event' : 'events'}`,
    },
    {
      key: 'service',
      label: 'Service hours',
      value: hours(k.serviceHours),
      caption: 'Logged at check-in',
    },
    {
      key: 'active',
      label: 'Active members',
      value: String(k.activeMembers),
      caption: `of ${k.totalMembers} · checked in or posted`,
    },
  ];
}

/** Ring percent for goals met; 0 with no goals. */
export function goalsPercent(k: ChapterKpis): number {
  return k.goalsTotal ? Math.round((k.goalsDone / k.goalsTotal) * 100) : 0;
}

/** "210 of 500 hours", "64% of 60%", or "Done" / "Not done" for custom goals. */
export function goalProgress(g: GoalResult): string {
  if (g.metric === 'custom') return g.met ? 'Done' : 'Not done';
  const fmt = (n: number) =>
    g.unit === 'percent'
      ? `${Math.round(n)}%`
      : g.unit === 'hours'
        ? `${hours(n)} hours`
        : String(n);
  if (g.value === null) return `Target ${fmt(g.target)}`;
  return g.unit === 'percent'
    ? `${fmt(g.value)} of ${fmt(g.target)}`
    : `${g.unit === 'hours' ? hours(g.value) : g.value} of ${fmt(g.target)}`;
}

/** "Updated just now", "Updated 20 min ago", "Updated 3 hr ago", "Updated Oct 12". */
export function updatedLabel(at: Date | null, now: Date): string {
  if (!at) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `Updated ${h} hr ago`;
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
  return `Updated ${MONTHS[at.getMonth()]} ${at.getDate()}`;
}
