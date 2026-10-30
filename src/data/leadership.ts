import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import type { GoalResult, KpiPeriodKind } from './types';

/** What's waiting for officers: membership requests and open reports. */
export type WaitingCounts = { membershipRequests: number; openReports: number };

/** Officers only: the rules let only officers read reports. */
export async function fetchWaitingCounts(): Promise<WaitingCounts> {
  const [requests, reports] = await Promise.all([
    getCountFromServer(query(collection(db, 'members'), where('status', '==', 'pending'))),
    getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'open'))),
  ]);
  return {
    membershipRequests: requests.data().count,
    openReports: reports.data().count,
  };
}

/** One period's numbers, as the leadership screen shows them. */
export type ChapterKpis = {
  period: string;
  label: string;
  participationRate: number | null;
  attendanceRate: number | null;
  serviceHours: number;
  activeMembers: number;
  totalMembers: number;
  eventsHeld: number;
  goals: GoalResult[];
  goalsDone: number;
  goalsTotal: number;
};

export type CurrentKpis = { periods: Record<KpiPeriodKind, ChapterKpis>; computedAt: Date | null };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const rate = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function toGoal(v: unknown): GoalResult | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as Record<string, unknown>;
  if (typeof g.id !== 'string' || typeof g.name !== 'string') return null;
  return {
    id: g.id,
    name: g.name,
    metric: g.metric as GoalResult['metric'],
    target: num(g.target),
    unit: (['percent', 'hours', 'count'].includes(g.unit as string)
      ? g.unit
      : 'count') as GoalResult['unit'],
    value: rate(g.value),
    met: g.met === true,
  };
}

/** Reads one period out of kpis/current, tolerating anything missing. */
export function toKpis(v: unknown): ChapterKpis | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as Record<string, unknown>;
  if (typeof k.period !== 'string') return null;
  const goals = Array.isArray(k.goals)
    ? k.goals.map(toGoal).filter((g): g is GoalResult => g !== null)
    : [];
  return {
    period: k.period,
    label: typeof k.label === 'string' ? k.label : k.period,
    participationRate: rate(k.participationRate),
    attendanceRate: rate(k.attendanceRate),
    serviceHours: num(k.serviceHours),
    activeMembers: num(k.activeMembers),
    totalMembers: num(k.totalMembers),
    eventsHeld: num(k.eventsHeld),
    goals,
    goalsDone: goals.filter((g) => g.met).length,
    goalsTotal: goals.length,
  };
}

/**
 * The chapter's numbers for the current semester, chapter year and last 30 days, computed
 * hourly by a Cloud Function (#47). Null until it has run once. Officers only.
 */
export async function fetchKpis(): Promise<CurrentKpis | null> {
  const snap = await getDoc(doc(db, 'kpis', 'current'));
  if (!snap.exists()) return null;
  const data = snap.data();
  const semester = toKpis(data.semester);
  const year = toKpis(data.year);
  const days30 = toKpis(data.days30);
  if (!semester || !year || !days30) return null;
  return {
    periods: { semester, year, days30 },
    computedAt: data.computedAt instanceof Timestamp ? data.computedAt.toDate() : null,
  };
}
