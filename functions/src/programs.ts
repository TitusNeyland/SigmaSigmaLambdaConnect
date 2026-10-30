import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { sendPush, type PushDeps, type PushMessage } from './push.js';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function helpOfferMessage(programId: string, who: string, program: string): PushMessage {
  return {
    title: `${who} can help`,
    body: `${who} offered to help with ${program}. Reach out to plan next steps.`,
    data: { programId },
  };
}

/**
 * Tells the program's owner that someone offered to help. Programs without an owner on
 * file go to every officer instead, so the offer is never lost.
 */
export async function notifyHelpOffer(programId: string, helperId: string, deps: PushDeps = {}) {
  const db = deps.db ?? getFirestore();
  const [program, helper] = await Promise.all([
    db.doc(`programs/${programId}`).get(),
    db.doc(`members/${helperId}`).get(),
  ]);
  if (!program.exists) return { sent: 0 };
  const owner = text(program.get('ownerId'));
  const recipients = owner ? [owner] : (await db.collection('roles').get()).docs.map((d) => d.id);
  const message = helpOfferMessage(
    programId,
    text(helper.get('displayName')) || 'A brother',
    text(program.get('name')) || 'a chapter program',
  );
  return sendPush(
    recipients.filter((uid) => uid !== helperId),
    'officer',
    message,
    deps,
  );
}

export const notifyProgramHelp = onDocumentCreated(
  'programs/{programId}/helpers/{uid}',
  async (event) => {
    await notifyHelpOffer(event.params.programId, event.params.uid);
  },
);
