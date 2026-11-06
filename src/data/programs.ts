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

import { chapterYearOf, statusFromMilestones } from '@/features/programs/programLogic';

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
  /** The lead's name when the program was saved, so the list doesn't look each one up. */
  ownerName: string;
  dueAt: Date | null;
  /** When the program was set up. Chapter health measures its pace from here. */
  createdAt: Date | null;
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
    ownerName: text(data.ownerName),
    dueAt: data.dueAt instanceof Timestamp ? data.dueAt.toDate() : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
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

/** What the program form saves. Milestones in order; ones with an id already exist. */
export type ProgramInput = {
  name: string;
  description: string;
  ownerId: string | null;
  ownerName: string;
  ownerTitle: string;
  dueAt: Date;
  milestones: { id?: string; name: string }[];
};

/** A new program and its milestones, in one write. Officers only; the rules check. */
export async function createProgram(input: ProgramInput, uid: string): Promise<string> {
  const ref = doc(collection(db, 'programs'));
  const batch = writeBatch(db);
  batch.set(ref, {
    name: input.name.trim(),
    description: input.description.trim(),
    ownerId: input.ownerId,
    ownerName: input.ownerId ? input.ownerName.trim() : '',
    ownerTitle: input.ownerTitle.trim(),
    dueAt: Timestamp.fromDate(input.dueAt),
    status: 'not_started',
    chapterYear: chapterYearOf(input.dueAt),
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  input.milestones.forEach((m, i) => {
    batch.set(doc(collection(ref, 'milestones')), {
      name: m.name.trim(),
      order: i + 1,
      done: false,
      doneAt: null,
      doneBy: null,
    });
  });
  await batch.commit();
  return ref.id;
}

/**
 * Saves an edited program: its details, and its milestones added, renamed, reordered or
 * removed. Checked-off milestones stay checked off. The status follows the milestones, except
 * Needs help, which stays until someone turns it off.
 */
export async function updateProgram(program: ProgramSummary, input: ProgramInput): Promise<void> {
  const ref = doc(db, 'programs', program.id);
  const batch = writeBatch(db);
  const kept = new Map(program.milestones.map((m) => [m.id, m]));
  const after: ProgramMilestone[] = [];
  input.milestones.forEach((m, i) => {
    const order = i + 1;
    const name = m.name.trim();
    const existing = m.id ? kept.get(m.id) : undefined;
    if (existing) {
      kept.delete(existing.id);
      after.push({ ...existing, name, order });
      if (existing.name !== name || existing.order !== order) {
        batch.update(doc(ref, 'milestones', existing.id), { name, order });
      }
    } else {
      const added = doc(collection(ref, 'milestones'));
      after.push({ id: added.id, name, order, done: false });
      batch.set(added, { name, order, done: false, doneAt: null, doneBy: null });
    }
  });
  for (const removed of kept.values()) batch.delete(doc(ref, 'milestones', removed.id));
  batch.update(ref, {
    name: input.name.trim(),
    description: input.description.trim(),
    ownerId: input.ownerId,
    ownerName: input.ownerId ? input.ownerName.trim() : '',
    ownerTitle: input.ownerTitle.trim(),
    dueAt: Timestamp.fromDate(input.dueAt),
    chapterYear: chapterYearOf(input.dueAt),
    status:
      program.status === 'at_risk' && !after.every((m) => m.done)
        ? 'at_risk'
        : statusFromMilestones(after),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Flags a program as needing help, or clears the flag (its status then follows its
 * milestones). Officers and the program's lead; the rules check.
 */
export async function setNeedsHelp(program: ProgramSummary, needsHelp: boolean): Promise<void> {
  await setDoc(
    doc(db, 'programs', program.id),
    {
      status: needsHelp ? 'at_risk' : statusFromMilestones(program.milestones),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Deletes a program with its milestones and help offers. Officers only. */
export async function deleteProgram(programId: string): Promise<void> {
  const ref = doc(db, 'programs', programId);
  const [milestones, helpers] = await Promise.all([
    getDocs(collection(ref, 'milestones')),
    getDocs(collection(ref, 'helpers')),
  ]);
  const batch = writeBatch(db);
  for (const d of [...milestones.docs, ...helpers.docs]) batch.delete(d.ref);
  batch.delete(ref);
  await batch.commit();
}
