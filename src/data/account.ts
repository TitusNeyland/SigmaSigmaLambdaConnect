import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from './firebase';

export type DeleteAccountError = 'wrong-password' | 'too-many-attempts' | 'offline' | 'failed';

/** Thrown by deleteAccount with a reason the screen can explain. */
export class AccountDeletionError extends Error {
  constructor(public readonly reason: DeleteAccountError) {
    super(reason);
    this.name = 'AccountDeletionError';
  }
}

function reasonFor(error: unknown): DeleteAccountError {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'wrong-password';
  if (code === 'auth/too-many-requests') return 'too-many-attempts';
  if (code === 'auth/network-request-failed' || code === 'functions/unavailable') return 'offline';
  return 'failed';
}

/**
 * Permanently deletes the signed-in member's account and data (#16).
 *
 * Confirms their password first, then asks the deleteAccount Cloud Function to remove
 * everything. The function also checks the sign-in was recent.
 */
export async function deleteAccount(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new AccountDeletionError('failed');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await httpsCallable(functions, 'deleteAccount')();
  } catch (error) {
    throw new AccountDeletionError(reasonFor(error));
  }
  // The account no longer exists; clear the local session too.
  await firebaseSignOut(auth).catch(() => {});
}
