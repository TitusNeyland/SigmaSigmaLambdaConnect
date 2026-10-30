import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { CHAPTER_TIME_ZONE } from './events.js';

/**
 * Chapter KPIs (#47), computed from real activity: officer check-ins (never RSVPs), service
 * hours logged at check-in, and posts. Goals and their targets are whatever the chapter sets
 * in goals/{goalId}; none of this is a national requirement or score.
 *
 * Results go to kpis/{periodId} (history) and kpis/current (all three current periods in one
 * doc, so the leadership screen needs a single read).
 */

export type PeriodKind = 'semester' | 'year' | 'days30';
export type Period = { id: string; kind: PeriodKind; label: string; start: Date; end: Date };

const DAY = 86_400_000;
/** The chapter year starts August 1. Fall runs Aug 1 to Dec 31, spring Jan 1 to Jul 31. */
const YEAR_START_MONTH = 7;

/** The wall-clock parts of an instant in a time zone. */
function zonedParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function offsetMs(at: Date, timeZone: string): number {
  const p = zonedParts(at, timeZone);
  const wall = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight on a calendar date in the chapter's time zone. `month` is 0-based and may overflow. */
export function localMidnight(
  year: number,
  month: number,
  day: number,
  timeZone = CHAPTER_TIME_ZONE,
): Date {
  const guess = Date.UTC(year, month, day);
  let t = guess - offsetMs(new Date(guess), timeZone);
  // Correct once if the guess landed on the other side of a daylight saving change.
  const second = guess - offsetMs(new Date(t), timeZone);
  if (second !== t) t = second;
  return new Date(t);
}

/** The semester, chapter year and last 30 days that contain `now`. */
export function currentPeriods(
  now: Date,
  timeZone = CHAPTER_TIME_ZONE,
): Record<PeriodKind, Period> {
  const { year, month } = zonedParts(now, timeZone);
  const fall = month >= YEAR_START_MONTH;
  const yearStart = fall ? year : year - 1;
  const short = String((yearStart + 1) % 100).padStart(2, '0');
  return {
    semester: fall
      ? {
          id: `${year}-fall`,
          kind: 'semester',
          label: `Fall ${year}`,
          start: localMidnight(year, YEAR_START_MONTH, 1, timeZone),
          end: localMidnight(year + 1, 0, 1, timeZone),
        }
      : {
          id: `${year}-spring`,
          kind: 'semester',
          label: `Spring ${year}`,
          start: localMidnight(year, 0, 1, timeZone),
          end: localMidnight(year, YEAR_START_MONTH, 1, timeZone),
        },
    year: {
      id: `${yearStart}-${short}`,
      kind: 'year',
      label: `${yearStart}-${short} chapter year`,
      start: localMidnight(yearStart, YEAR_START_MONTH, 1, timeZone),
      end: localMidnight(yearStart + 1, YEAR_START_MONTH, 1, timeZone),
    },
    days30: {
      id: 'last-30-days',
      kind: 'days30',
      label: 'Last 30 days',
      start: new Date(now.getTime() - 30 * DAY),
      end: now,
    },
  };
}

export type CheckIn = { memberId: string; serviceHours?: unknown };
export type ActivityData = {
  /** Approved members right now. */
  approved: ReadonlySet<string>;
  /** Events held in the period (not cancelled, already started), with their check-ins. */
  events: { id: string; checkIns: CheckIn[] }[];
  /** Authors of posts in the period. */
  posters: ReadonlySet<string>;
};

export type Metrics = {
  /** Share of approved members checked in to at least one event. Null with no events. */
  participationRate: number | null;
  /** Average share of approved members checked in per event. Null with no events. */
  attendanceRate: number | null;
  /** Hours logged at check-in. */
  serviceHours: number;
  /** Approved members who checked in or posted. */
  activeMembers: number;
  totalMembers: number;
  eventsHeld: number;
};

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;
const hours = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 24 ? v : 0;

export function summarize({ approved, events, posters }: ActivityData): Metrics {
  const total = approved.size;
  const attended = new Set<string>();
  let serviceHours = 0;
  const turnouts: number[] = [];

  for (const event of events) {
    const here = new Set<string>();
    for (const c of event.checkIns) {
      // Only current members count; someone who left or was declined drops out.
      if (!approved.has(c.memberId)) continue;
      here.add(c.memberId);
      serviceHours += hours(c.serviceHours);
    }
    for (const uid of here) attended.add(uid);
    turnouts.push(total ? here.size / total : 0);
  }

  const active = new Set(attended);
  for (const uid of posters) if (approved.has(uid)) active.add(uid);

  return {
    participationRate: events.length ? round(total ? attended.size / total : 0) : null,
    attendanceRate: events.length
      ? round(turnouts.reduce((a, b) => a + b, 0) / turnouts.length)
      : null,
    serviceHours: round(serviceHours, 1),
    activeMembers: active.size,
    totalMembers: total,
    eventsHeld: events.length,
  };
}

const METRICS = [
  'participation',
  'attendance',
  'service_hours',
  'active_members',
  'custom',
] as const;
type GoalMetric = (typeof METRICS)[number];

export type GoalResult = {
  id: string;
  name: string;
  metric: GoalMetric;
  target: number;
  unit: 'percent' | 'hours' | 'count';
  /** Where the chapter is now, in the goal's unit. Null for custom goals and no data yet. */
  value: number | null;
  met: boolean;
};

const UNITS: Record<Exclude<GoalMetric, 'custom'>, GoalResult['unit']> = {
  participation: 'percent',
  attendance: 'percent',
  service_hours: 'hours',
  active_members: 'count',
};

/**
 * Checks the chapter's own goals against the chapter year's numbers. Custom goals are met
 * when an officer marks them done. Malformed goals are skipped.
 */
export function evaluateGoals(
  goals: { id: string; data: Record<string, unknown> }[],
  year: Metrics,
): GoalResult[] {
  const out: GoalResult[] = [];
  for (const { id, data } of goals) {
    const metric = data.metric as GoalMetric;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name || !METRICS.includes(metric)) continue;
    if (metric === 'custom') {
      const unit = ['percent', 'hours', 'count'].includes(data.unit as string)
        ? (data.unit as GoalResult['unit'])
        : 'count';
      const target =
        typeof data.target === 'number' && Number.isFinite(data.target) ? data.target : 0;
      out.push({ id, name, metric, target, unit, value: null, met: data.done === true });
      continue;
    }
    if (typeof data.target !== 'number' || !Number.isFinite(data.target) || data.target < 0)
      continue;
    const value =
      metric === 'participation'
        ? year.participationRate === null
          ? null
          : round(year.participationRate * 100, 1)
        : metric === 'attendance'
          ? year.attendanceRate === null
            ? null
            : round(year.attendanceRate * 100, 1)
          : metric === 'service_hours'
            ? year.serviceHours
            : year.activeMembers;
    out.push({
      id,
      name,
      metric,
      target: data.target,
      unit: UNITS[metric],
      value,
      met: value !== null && value >= data.target,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Reads the activity for one period from Firestore. */
export async function loadActivity(
  db: Firestore,
  period: Period,
  now: Date,
): Promise<ActivityData> {
  const end = new Date(Math.min(period.end.getTime(), now.getTime()));
  const [members, events, posts] = await Promise.all([
    db.collection('members').where('status', '==', 'approved').get(),
    db
      .collection('events')
      .where('startsAt', '>=', Timestamp.fromDate(period.start))
      .where('startsAt', '<', Timestamp.fromDate(end))
      .get(),
    db
      .collection('posts')
      .where('createdAt', '>=', Timestamp.fromDate(period.start))
      .where('createdAt', '<', Timestamp.fromDate(end))
      .get(),
  ]);
  const held = events.docs.filter((d) => d.get('cancelled') !== true);
  const checkIns = await Promise.all(
    held.map(async (e) => ({
      id: e.id,
      checkIns: (await e.ref.collection('attendance').get()).docs.map((a) => ({
        memberId: typeof a.get('memberId') === 'string' ? (a.get('memberId') as string) : a.id,
        serviceHours: a.get('serviceHours'),
      })),
    })),
  );
  return {
    approved: new Set(members.docs.map((d) => d.id)),
    events: checkIns,
    posters: new Set(
      posts.docs
        .filter((p) => p.get('removed') !== true)
        .map((p) => p.get('authorId'))
        .filter((a): a is string => typeof a === 'string'),
    ),
  };
}

export type Snapshot = Metrics & {
  period: string;
  kind: PeriodKind;
  label: string;
  start: Timestamp;
  end: Timestamp;
  /** The chapter year's goals, checked against the chapter year's numbers. */
  goals: GoalResult[];
  goalsDone: number;
  goalsTotal: number;
  computedAt: Timestamp;
};

/** Computes all three current periods and saves them. Returns what it wrote to kpis/current. */
export async function computeKpis(db: Firestore = getFirestore(), now = new Date()) {
  const periods = currentPeriods(now);
  const kinds: PeriodKind[] = ['year', 'semester', 'days30'];
  const metrics = Object.fromEntries(
    await Promise.all(
      kinds.map(async (k) => [k, summarize(await loadActivity(db, periods[k], now))] as const),
    ),
  ) as Record<PeriodKind, Metrics>;

  const goalDocs = await db.collection('goals').where('chapterYear', '==', periods.year.id).get();
  const goals = evaluateGoals(
    goalDocs.docs.map((d) => ({ id: d.id, data: d.data() })),
    metrics.year,
  );
  const computedAt = Timestamp.fromDate(now);

  const current = {} as Record<PeriodKind, Snapshot>;
  const batch = db.batch();
  for (const k of kinds) {
    const p = periods[k];
    const snap: Snapshot = {
      ...metrics[k],
      period: p.id,
      kind: k,
      label: p.label,
      start: Timestamp.fromDate(p.start),
      end: Timestamp.fromDate(p.end),
      goals,
      goalsDone: goals.filter((g) => g.met).length,
      goalsTotal: goals.length,
      computedAt,
    };
    current[k] = snap;
    batch.set(db.doc(`kpis/${p.id}`), snap);
  }
  batch.set(db.doc('kpis/current'), { ...current, computedAt });
  await batch.commit();
  return current;
}

/** Recomputes every hour, so the leadership screen is never more than an hour behind. */
export const kpisHourly = onSchedule(
  { schedule: 'every 60 minutes', timeZone: CHAPTER_TIME_ZONE },
  async () => {
    const current = await computeKpis();
    logger.info('KPIs computed', { periods: Object.values(current).map((s) => s.period) });
  },
);

/** When officers change a goal or its target, the ring updates right away. */
export const kpisOnGoalChange = onDocumentWritten('goals/{goalId}', async () => {
  await computeKpis();
});
