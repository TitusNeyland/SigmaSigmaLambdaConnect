import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

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
 */
export function subscribeToOwnMember(
  uid: string,
  onChange: (member: MemberSummary | null) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'members', uid),
    (snap) => {
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

/** Writes a pending profile for someone whose sign up didn't finish. */
export async function createPendingProfile(
  uid: string,
  input: { displayName: string; initiationTerm: string; email: string | null },
): Promise<void> {
  await setDoc(doc(db, 'members', uid), {
    displayName: input.displayName.trim(),
    initiationTerm: input.initiationTerm.trim(),
    ...(input.email ? { email: input.email } : {}),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}
