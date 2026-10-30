import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

import { db } from './firebase';
import type { ProgressStatus } from './types';

export type ProgramMilestone = {
  id: string;
  name: string;
  order: number;
  done: boolean;
};

/** A chapter program with its milestones in order (#44). */
export type ProgramSummary = {
  id: string;
  name: string;
  description: string;
  ownerTitle: string;
  ownerId: string | null;
  dueAt: Date | null;
  status: ProgressStatus;
  chapterYear: string;
  milestones: ProgramMilestone[];
};

const STATUSES: readonly ProgressStatus[] = ['not_started', 'in_progress', 'at_risk', 'completed'];
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function toMilestone(id: string, data: Record<string, unknown>): ProgramMilestone {
  return {
    id,
    name: text(data.name) || 'Milestone',
    order: typeof data.order === 'number' ? data.order : 0,
    done: data.done === true,
  };
}

export function toProgram(
  id: string,
  data: Record<string, unknown>,
  milestones: ProgramMilestone[],
): ProgramSummary {
  return {
    id,
    name: text(data.name) || 'Untitled program',
    description: text(data.description),
    ownerTitle: text(data.ownerTitle),
    ownerId: text(data.ownerId) || null,
    dueAt: data.dueAt instanceof Timestamp ? data.dueAt.toDate() : null,
    status: STATUSES.includes(data.status as ProgressStatus)
      ? (data.status as ProgressStatus)
      : 'not_started',
    chapterYear: text(data.chapterYear),
    milestones: [...milestones].sort((a, b) => a.order - b.order),
  };
}

async function milestonesOf(programId: string): Promise<ProgramMilestone[]> {
  const snap = await getDocs(collection(db, 'programs', programId, 'milestones'));
  return snap.docs.map((d) => toMilestone(d.id, d.data()));
}

/** Every program, soonest due first, each with its milestones. A chapter has a handful. */
export async function fetchPrograms(): Promise<ProgramSummary[]> {
  const snap = await getDocs(query(collection(db, 'programs'), orderBy('dueAt', 'asc')));
  return Promise.all(
    snap.docs.map(async (d) => toProgram(d.id, d.data(), await milestonesOf(d.id))),
  );
}

export async function fetchProgram(id: string): Promise<ProgramSummary | null> {
  const [snap, milestones] = await Promise.all([getDoc(doc(db, 'programs', id)), milestonesOf(id)]);
  return snap.exists() ? toProgram(snap.id, snap.data(), milestones) : null;
}

/**
 * Checks a milestone off (or back on) and updates the program's status to match, in one
 * write. Officers only; the rules enforce it.
 */
export async function setMilestoneDone(
  programId: string,
  milestoneId: string,
  done: boolean,
  uid: string,
  status: ProgressStatus,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'programs', programId, 'milestones', milestoneId), {
    done,
    doneAt: done ? serverTimestamp() : null,
    doneBy: done ? uid : null,
  });
  batch.update(doc(db, 'programs', programId), { status, updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Whether the member already offered to help with each program, by program ID. */
export async function fetchMyHelpOffers(
  programIds: string[],
  uid: string,
): Promise<ReadonlySet<string>> {
  const offered = await Promise.all(
    programIds.map(
      async (id) => [id, (await getDoc(doc(db, 'programs', id, 'helpers', uid))).exists()] as const,
    ),
  );
  return new Set(offered.filter(([, yes]) => yes).map(([id]) => id));
}

/** Offers to help with a program. A Cloud Function tells its owner (or the officers). */
export async function offerHelp(programId: string, uid: string): Promise<void> {
  await setDoc(doc(db, 'programs', programId, 'helpers', uid), {
    memberId: uid,
    createdAt: serverTimestamp(),
  });
}
