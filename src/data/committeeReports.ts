import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { db, storage } from './firebase';

/**
 * Committee reports. Any approved member submits one; a Cloud Function emails it to the
 * addresses admins set (functions/src/committeeReports.ts) and records how that went.
 */
export type ReportAttachment = {
  path: string;
  name: string;
  contentType: string;
  size: number;
};

/** Set by the Cloud Function once it tries to email the report. */
export type EmailStatus = 'sent' | 'failed' | 'no_recipients' | 'invalid';

export type CommitteeReport = {
  id: string;
  authorId: string;
  /** Filled in by the Cloud Function; null until it runs. */
  authorName: string | null;
  committee: string;
  period: string;
  summary: string;
  attachment: ReportAttachment | null;
  /** Null while it's still being sent. */
  emailStatus: EmailStatus | null;
  createdAt: Date;
};

export type NewReport = { committee: string; period: string; summary: string };

/** A file picked on the phone, ready to upload. */
export type LocalFile = { uri: string; name: string; mimeType: string; size: number };

/** How many reports the Documents list shows. */
export const REPORTS_LIMIT = 50;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const STATUSES: readonly EmailStatus[] = ['sent', 'failed', 'no_recipients', 'invalid'];

function toAttachment(v: unknown): ReportAttachment | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  const path = str(a.path);
  if (!path) return null;
  return {
    path,
    name: str(a.name) || 'File',
    contentType: str(a.contentType),
    size: typeof a.size === 'number' ? a.size : 0,
  };
}

export function toCommitteeReport(id: string, data: DocumentData): CommitteeReport | null {
  const committee = str(data.committee);
  if (!committee || !(data.createdAt instanceof Timestamp)) return null;
  return {
    id,
    authorId: str(data.authorId),
    authorName: str(data.authorName) || null,
    committee,
    period: str(data.period),
    summary: str(data.summary),
    attachment: toAttachment(data.attachment),
    emailStatus: STATUSES.includes(data.emailStatus) ? data.emailStatus : null,
    createdAt: data.createdAt.toDate(),
  };
}

/** A new report's ID, made up front so its file can be uploaded under it first. */
export function newReportId(): string {
  return doc(collection(db, 'committeeReports')).id;
}

/** Keeps a file name safe for a Storage path: letters, digits, dot, dash, underscore. */
export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.slice(-100) || 'file';
}

/** Uploads a report's file under the member's ID. Reports progress from 0 to 1. */
export async function uploadReportFile(
  uid: string,
  reportId: string,
  file: LocalFile,
  onProgress?: (fraction: number) => void,
): Promise<ReportAttachment> {
  const path = `committeeReports/${uid}/${reportId}/${safeFileName(file.name)}`;
  const blob = await (await fetch(file.uri)).blob();
  const task = uploadBytesResumable(ref(storage, path), blob, { contentType: file.mimeType });
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(),
    );
  });
  onProgress?.(1);
  // Some pickers don't report a size; the uploaded bytes do.
  return {
    path,
    name: file.name.trim() || 'File',
    contentType: file.mimeType,
    size: blob.size || file.size,
  };
}

/** Saves the report, which emails it. Only the fields the rules allow. */
export async function submitReport(
  uid: string,
  id: string,
  report: NewReport,
  attachment: ReportAttachment | null,
): Promise<void> {
  await setDoc(doc(db, 'committeeReports', id), {
    authorId: uid,
    committee: report.committee.trim(),
    period: report.period.trim(),
    summary: report.summary.trim(),
    attachment,
    createdAt: serverTimestamp(),
  });
}

function toList(docs: { id: string; data(): DocumentData }[]): CommitteeReport[] {
  return docs
    .map((d) => toCommitteeReport(d.id, d.data()))
    .filter((r): r is CommitteeReport => r !== null);
}

/** The member's own reports, newest first. */
export async function fetchMyReports(uid: string): Promise<CommitteeReport[]> {
  const snap = await getDocs(
    query(
      collection(db, 'committeeReports'),
      where('authorId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(REPORTS_LIMIT),
    ),
  );
  return toList(snap.docs);
}

/** Every report, newest first. Officers only; the rules check. */
export async function fetchAllReports(): Promise<CommitteeReport[]> {
  const snap = await getDocs(
    query(collection(db, 'committeeReports'), orderBy('createdAt', 'desc'), limit(REPORTS_LIMIT)),
  );
  return toList(snap.docs);
}

export async function fetchReport(id: string): Promise<CommitteeReport | null> {
  const snap = await getDoc(doc(db, 'committeeReports', id));
  return snap.exists() ? toCommitteeReport(snap.id, snap.data()) : null;
}

/** A link that opens the report's file. */
export const reportFileUrl = (path: string) => getDownloadURL(ref(storage, path));

/** Who reports are emailed to. Admins only; the rules check. */
export async function fetchRecipients(): Promise<string[]> {
  const emails = (await getDoc(doc(db, 'settings', 'reportRecipients'))).get('emails');
  return Array.isArray(emails) ? emails.filter((e): e is string => typeof e === 'string') : [];
}

export async function saveRecipients(uid: string, emails: string[]): Promise<void> {
  await setDoc(doc(db, 'settings', 'reportRecipients'), {
    emails,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
