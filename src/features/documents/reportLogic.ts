import type { CommitteeReport, LocalFile, NewReport } from '@/data/committeeReports';
import type { ChipTone } from '@/ui/StatusChip';

/** Limits, matching the security rules. */
export const MAX_COMMITTEE = 60;
export const MAX_PERIOD = 40;
export const MAX_SUMMARY = 5000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_RECIPIENTS = 10;

/** What the file picker offers. The storage rules allow the same. */
export const FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/*',
];

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

/** The file's type, from what the phone said or else its extension. */
export function fileType(name: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? 'application/octet-stream';
}

export function allowedType(mimeType: string): boolean {
  return (
    mimeType === 'application/pdf' ||
    mimeType === 'application/msword' ||
    mimeType.startsWith('application/vnd.openxmlformats-officedocument.') ||
    mimeType.startsWith('image/')
  );
}

/** Why a file can't be attached, or null if it can. */
export function fileProblem(file: Pick<LocalFile, 'mimeType' | 'size'>): string | null {
  if (!allowedType(file.mimeType)) return 'Attach a PDF, Word file or photo.';
  if (file.size >= MAX_FILE_BYTES) return 'Files can be up to 10 MB.';
  return null;
}

/** "820 bytes", "240 KB", "1.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function canSubmit(r: NewReport): boolean {
  return (
    r.committee.trim().length > 0 &&
    r.committee.trim().length <= MAX_COMMITTEE &&
    r.period.trim().length > 0 &&
    r.period.trim().length <= MAX_PERIOD &&
    r.summary.trim().length > 0 &&
    r.summary.trim().length <= MAX_SUMMARY
  );
}

/** "Service · October 2026" */
export const reportTitle = (r: Pick<CommitteeReport, 'committee' | 'period'>) =>
  `${r.committee} · ${r.period}`;

/** Whether the email went out, in words and a chip color. */
export function emailStatus(r: Pick<CommitteeReport, 'emailStatus'>): {
  label: string;
  tone: ChipTone;
} {
  switch (r.emailStatus) {
    case 'sent':
      return { label: 'Emailed', tone: 'success' };
    case 'no_recipients':
      return { label: 'Not emailed: no recipients set', tone: 'warning' };
    case 'failed':
    case 'invalid':
      return { label: 'Couldn’t email', tone: 'warning' };
    default:
      return { label: 'Sending', tone: 'neutral' };
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 5", with the year when it isn't this year. */
export function shortDate(date: Date, now: Date): string {
  const day = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day}, ${date.getFullYear()}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reads the recipients box: addresses split by lines, commas or spaces, each once,
 * lowercased. Anything that isn't an email address comes back in `invalid`.
 */
export function parseEmails(text: string): { emails: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const emails = [...new Set(parts.filter((p) => EMAIL.test(p)))];
  return { emails, invalid: parts.filter((p) => !EMAIL.test(p)) };
}
