import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { normalizeEmail, type SignUpInput } from '@/features/auth/validation';

import { auth, db } from './firebase';

/**
 * Account actions. Screens call these instead of firebase/auth directly, which keeps the
 * Firebase details in one place and makes screens easy to test with a mock.
 */

export type AuthUser = Pick<User, 'uid' | 'email' | 'emailVerified' | 'displayName'>;

export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => callback(user));
}

/**
 * Creates the sign-in account, then the member's own pending profile. Officers approve it
 * later (#11). Sends a verification email (#10).
 */
export async function signUp(input: SignUpInput): Promise<void> {
  const email = normalizeEmail(input.email);
  const { user } = await createUserWithEmailAndPassword(auth, email, input.password);
  const displayName = input.displayName.trim();
  await updateProfile(user, { displayName });
  await setDoc(doc(db, 'members', user.uid), {
    displayName,
    initiationTerm: input.initiationTerm.trim(),
    email,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  await sendEmailVerification(user).catch(() => {
    // Sign up still worked; the verify screen (#10) lets them resend.
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
