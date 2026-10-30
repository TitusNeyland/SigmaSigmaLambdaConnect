import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { sendPush, type PushDeps, type PushMessage } from './push.js';
import { preview } from './social.js';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function announcementMessage(
  id: string,
  data: { title?: unknown; body?: unknown; authorTitle?: unknown },
): PushMessage | null {
  const title = text(data.title);
  if (!title) return null;
  const by = text(data.authorTitle);
  return {
    title,
    body: [by ? `${by}:` : '', preview(text(data.body), 120)].filter(Boolean).join(' '),
    data: { announcementId: id, screen: 'chapter' },
  };
}

/** Pushes a new announcement to every approved member except the officer who posted it. */
export async function announce(
  id: string,
  data: { title?: unknown; body?: unknown; authorTitle?: unknown; authorId?: unknown },
  deps: PushDeps = {},
) {
  const message = announcementMessage(id, data);
  if (!message) return { sent: 0 };
  const db = deps.db ?? getFirestore();
  const members = await db.collection('members').where('status', '==', 'approved').get();
  return sendPush(
    members.docs.map((d) => d.id).filter((uid) => uid !== text(data.authorId)),
    'announcements',
    message,
    deps,
  );
}

export const notifyAnnouncement = onDocumentCreated('announcements/{id}', async (event) => {
  const data = event.data?.data();
  if (data) await announce(event.params.id, data);
});
