import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firebase';

export type PushPlatform = 'ios' | 'android';

/** Firestore IDs can't contain "/", and Expo tokens have brackets; keep it to safe characters. */
export function tokenDocId(token: string): string {
  return token.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Saves this phone's push token under the member. Only they can read or write it; Cloud
 * Functions read it to send (#26). One member can have several phones.
 */
export async function savePushToken(
  uid: string,
  token: string,
  platform: PushPlatform,
): Promise<void> {
  await setDoc(doc(db, 'pushTokens', uid, 'tokens', tokenDocId(token)), {
    token,
    platform,
    updatedAt: serverTimestamp(),
  });
}

/** Forgets this phone, so a signed-out phone stops getting the member's notifications. */
export async function removePushToken(uid: string, token: string): Promise<void> {
  await deleteDoc(doc(db, 'pushTokens', uid, 'tokens', tokenDocId(token)));
}
