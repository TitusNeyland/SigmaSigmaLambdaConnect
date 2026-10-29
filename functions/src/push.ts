import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

/**
 * What a notification is about. The first four match the switches in Settings (#15);
 * `account` (like being approved) always sends.
 */
export type PushKind = 'events' | 'announcements' | 'social' | 'tasks' | 'account';

type PrefKey = Exclude<PushKind, 'account'>;

/** Must match DEFAULT_NOTIFICATION_PREFS in src/data/types.ts (a unit test checks). */
export const DEFAULT_PREFS: Record<PrefKey, boolean> = {
  events: true,
  announcements: true,
  social: true,
  tasks: false,
};

export type PushMessage = {
  title: string;
  body: string;
  /** Read by the app when the notification is tapped, e.g. { eventId }. */
  data?: Record<string, string>;
};

/**
 * Whether this member wants this kind of notification. Reads their saved switches,
 * falling back to the defaults for anything missing or malformed.
 */
export function wantsPush(member: Record<string, unknown> | undefined, kind: PushKind): boolean {
  if (!member) return false;
  if (kind === 'account') return true;
  // Chapter notifications only go to approved members.
  if (member.status !== 'approved') return false;
  const prefs = member.notificationPrefs;
  const saved =
    prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>)[kind] : undefined;
  return typeof saved === 'boolean' ? saved : DEFAULT_PREFS[kind];
}

/** Expo's push API takes up to 100 messages per request. */
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

export function chunk<T>(items: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };
type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type PushDeps = { db?: Firestore; fetchImpl?: FetchLike };

/**
 * Sends one message to each member's phones, respecting their Settings. Tokens Expo says
 * are dead (the app was deleted) are removed. Returns how many phones it sent to.
 */
export async function sendPush(
  uids: string[],
  kind: PushKind,
  message: PushMessage,
  deps: PushDeps = {},
): Promise<{ sent: number; skippedMembers: number }> {
  const db = deps.db ?? getFirestore();
  const send = deps.fetchImpl ?? (fetch as unknown as FetchLike);
  const unique = [...new Set(uids)].filter(Boolean);
  if (unique.length === 0) return { sent: 0, skippedMembers: 0 };

  const memberSnaps = await db.getAll(...unique.map((uid) => db.doc(`members/${uid}`)));
  const wanted = memberSnaps.filter((s) => wantsPush(s.data(), kind)).map((s) => s.id);

  const tokens = (
    await Promise.all(
      wanted.map(async (uid) => {
        const snap = await db.collection(`pushTokens/${uid}/tokens`).get();
        return snap.docs
          .map((d) => ({ ref: d.ref, token: d.get('token') as unknown }))
          .filter((t): t is { ref: typeof t.ref; token: string } => typeof t.token === 'string');
      }),
    )
  ).flat();

  let sent = 0;
  for (const batch of chunk(tokens)) {
    const res = await send(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(
        batch.map(({ token }) => ({
          to: token,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: 'default',
          channelId: 'default',
        })),
      ),
    });
    if (!res.ok) {
      logger.error('Expo push request failed', { status: res.status });
      continue;
    }
    const tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
    await Promise.all(
      tickets.map(async (ticket, i) => {
        if (ticket.status === 'ok') {
          sent++;
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          await batch[i].ref.delete();
        } else {
          logger.warn('Push not sent', { error: ticket.details?.error });
        }
      }),
    );
  }
  return { sent, skippedMembers: unique.length - wanted.length };
}

/** The message for a member whose status just changed, or null if there's nothing to say. */
export function approvalMessage(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): PushMessage | null {
  if (before?.status !== 'pending' || after?.status !== 'approved') return null;
  return {
    title: 'You’re in',
    body: 'An officer approved your membership. Welcome to Sigma Sigma Lambda Connect.',
    data: { screen: 'home' },
  };
}

/** Tells a new member the moment an officer approves them (#11, #25). */
export const notifyApproval = onDocumentUpdated('members/{uid}', async (event) => {
  const message = approvalMessage(event.data?.before.data(), event.data?.after.data());
  if (!message) return;
  await sendPush([event.params.uid], 'account', message);
});
