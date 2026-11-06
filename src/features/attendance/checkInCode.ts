import type { RosterEntry } from '@/data/attendance';

/**
 * Check-in codes: each brother shows a QR code on his profile, and an officer scans it from
 * Take attendance to check him in. The code is just the app's prefix and his member ID, so
 * it never changes and holds nothing private. Scanning only marks him on the officer's
 * roster; the officer still saves, and the rules still decide who can write attendance.
 */
export const CHECK_IN_PREFIX = 'sslconnect:checkin:';

export const checkInCode = (uid: string) => `${CHECK_IN_PREFIX}${uid}`;

/** The member ID in a scanned code, or null if it isn't one of ours. */
export function readCheckInCode(data: string): string | null {
  const text = data.trim();
  if (!text.startsWith(CHECK_IN_PREFIX)) return null;
  const uid = text.slice(CHECK_IN_PREFIX.length);
  return /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
}

export type ScanResult =
  | { kind: 'added'; uid: string; name: string }
  | { kind: 'already'; name: string }
  | { kind: 'unknown' }
  | { kind: 'invalid' };

/** What a scan means for this roster, given who's already checked. */
export function scanCheckIn(
  data: string,
  members: Pick<RosterEntry, 'uid' | 'displayName'>[],
  checked: ReadonlySet<string>,
): ScanResult {
  const uid = readCheckInCode(data);
  if (!uid) return { kind: 'invalid' };
  const member = members.find((m) => m.uid === uid);
  if (!member) return { kind: 'unknown' };
  if (checked.has(uid)) return { kind: 'already', name: member.displayName };
  return { kind: 'added', uid, name: member.displayName };
}

/** What the scanner says after a scan. */
export function scanMessage(result: ScanResult): string {
  switch (result.kind) {
    case 'added':
      return `${result.name} is checked. Save when you're done.`;
    case 'already':
      return `${result.name} is already checked.`;
    case 'unknown':
      return 'That code isn’t for an approved brother.';
    case 'invalid':
      return 'That isn’t a Sigma Sigma Lambda check-in code.';
  }
}
