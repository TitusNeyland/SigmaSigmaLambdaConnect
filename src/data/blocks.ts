import { collection, deleteDoc, doc, getDoc, onSnapshot } from 'firebase/firestore';

import { db } from './firebase';

/** Someone the member has blocked, with enough to show them in a list. */
export type BlockedAccount = {
  uid: string;
  displayName: string;
  photoURL: string | null;
};

/**
 * Live list of the people this member blocked, newest first. Looks up each person's name;
 * someone whose profile was deleted shows as "Former member".
 */
export function subscribeToBlocked(
  uid: string,
  onChange: (accounts: BlockedAccount[]) => void,
  onError: (error: unknown) => void,
): () => void {
  let latest = 0;
  return onSnapshot(
    collection(db, 'blocks', uid, 'blocked'),
    (snap) => {
      const run = ++latest;
      const entries = snap.docs
        .map((d) => ({ id: d.id, at: d.data().createdAt?.toMillis?.() ?? 0 }))
        .sort((a, b) => b.at - a.at);
      Promise.all(
        entries.map(async ({ id }): Promise<BlockedAccount> => {
          try {
            const member = await getDoc(doc(db, 'members', id));
            const data = member.exists() ? member.data() : {};
            const name = typeof data.displayName === 'string' ? data.displayName : '';
            const photo = typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null;
            return { uid: id, displayName: name || 'Former member', photoURL: photo };
          } catch {
            return { uid: id, displayName: 'Former member', photoURL: null };
          }
        }),
      ).then((accounts) => {
        // Ignore results from an older snapshot that finished late.
        if (run === latest) onChange(accounts);
      }, onError);
    },
    onError,
  );
}

/** Unblocks someone. Their posts and comments show again. */
export async function unblock(uid: string, otherUid: string): Promise<void> {
  await deleteDoc(doc(db, 'blocks', uid, 'blocked', otherUid));
}
