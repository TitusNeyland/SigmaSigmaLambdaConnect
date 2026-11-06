import { doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';

import type { SignUpAbout } from '@/features/auth/validation';

import { db } from './firebase';
import type { MemberStatus } from './types';

/** The parts of a member's own profile the app needs to decide what to show. */
export type MemberSummary = {
  displayName: string;
  initiationTerm: string;
  status: MemberStatus;
};

/**
 * Listens to the signed-in member's own profile. Calls back with null if there is no
 * profile yet (for example, sign up was interrupted before it was written).
 *
 * Only what the server has confirmed counts. Firestore shows the phone's own writes right
 * away, before the server checks them; if a write is then rejected, it takes it back. Going
 * by unconfirmed writes would send a brother to Waiting for approval and straight back again.
 */
export function subscribeToOwnMember(
  uid: string,
  onChange: (member: MemberSummary | null) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'members', uid),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data();
      onChange({
        displayName: String(data.displayName ?? ''),
        initiationTerm: String(data.initiationTerm ?? ''),
        status: (data.status as MemberStatus) ?? 'pending',
      });
    },
    onError,
  );
}

/** A new member's private contact doc: everything hidden until they choose to show it. */
export function newContact(email: string) {
  return { email, phone: '', showEmail: false, showPhone: false, updatedAt: serverTimestamp() };
}

/** Writes a pending profile for someone whose sign up didn't finish. */
/** The optional About you answers, only the ones he filled in. */
export function aboutFields(about: SignUpAbout | undefined): Record<string, string | string[]> {
  if (!about) return {};
  const fields: Record<string, string | string[]> = {};
  const headline = about.headline.trim();
  const industry = about.industry.trim();
  const businesses = about.businesses.map((b) => b.trim()).filter(Boolean);
  const interests = about.interests.map((i) => i.trim()).filter(Boolean);
  if (headline) fields.headline = headline;
  if (industry) fields.industry = industry;
  if (businesses.length) fields.businesses = businesses;
  if (interests.length) fields.interests = interests;
  return fields;
}

export async function createPendingProfile(
  uid: string,
  input: {
    displayName: string;
    initiationTerm: string;
    email: string | null;
    about?: SignUpAbout;
  },
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'members', uid), {
    displayName: input.displayName.trim(),
    initiationTerm: input.initiationTerm.trim(),
    ...aboutFields(input.about),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'members', uid, 'private', 'contact'), newContact(input.email ?? ''));
  await batch.commit();
}
