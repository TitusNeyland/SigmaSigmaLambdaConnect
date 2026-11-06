import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

/**
 * A welcome post in the feed when an officer approves a new brother, so the chapter meets
 * him without anyone having to post. It's an official chapter post (it shows as Sigma Sigma
 * Lambda), by the officer who approved him, and tags him. One per brother: its ID is
 * welcome-{uid}, so approving him again never posts twice. Deleting his account deletes it.
 */

export const welcomePostId = (uid: string) => `welcome-${uid}`;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(text).filter(Boolean) : ([] as string[]));

/** "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * "Please welcome Brother Marcus Reed to the chapter! Spring 2019 line. Works in Real estate
 * (Broker). Owns Sample Realty. Say hello and welcome him in." Leaves out what he skipped.
 */
export function welcomeCaption(member: Record<string, unknown>): string {
  const name = text(member.displayName);
  const term = text(member.initiationTerm);
  const headline = text(member.headline);
  const industry = text(member.industry);
  const businesses = list(member.businesses);
  const work = industry
    ? `Works in ${industry}${headline ? ` (${headline})` : ''}.`
    : headline
      ? `${headline}.`
      : '';
  return [
    name
      ? `Please welcome Brother ${name} to the chapter!`
      : 'Please welcome our newest brother to the chapter!',
    term ? `${term} line.` : '',
    work,
    businesses.length ? `Owns ${joinNames(businesses)}.` : '',
    'Say hello and welcome him in.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Posts the welcome when a member goes from pending to approved. Returns whether it did. */
export async function postWelcome(
  uid: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  db: Firestore = getFirestore(),
): Promise<boolean> {
  if (before?.status !== 'pending' || after?.status !== 'approved') return false;
  // The officer who approved him writes it; without one there's no one to post as.
  const officer = text(after.reviewedBy);
  if (!officer) return false;
  try {
    await db.doc(`posts/${welcomePostId(uid)}`).create({
      authorId: officer,
      caption: welcomeCaption(after),
      photoPaths: [],
      eventId: null,
      taggedMemberIds: [uid],
      allowComments: true,
      official: true,
      aspectRatio: 1,
      removed: false,
      likeCount: 0,
      commentCount: 0,
      welcomeFor: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    // Already welcomed (approved, declined, then approved again): leave the first one.
    if ((error as { code?: number }).code === 6) return false;
    throw error;
  }
}

export const postWelcomeOnApproval = onDocumentUpdated('members/{uid}', async (event) => {
  try {
    await postWelcome(event.params.uid, event.data?.before.data(), event.data?.after.data());
  } catch (error) {
    logger.error('Welcome post failed', { uid: event.params.uid, error: String(error) });
  }
});
