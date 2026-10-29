import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
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
  return onAuthStateChanged(auth, (user) => callback(toAuthUser(user)));
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

/** Sends the verification email again to the signed-in user. */
export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) throw new Error('Not signed in');
  await sendEmailVerification(auth.currentUser);
}

/**
 * Reloads the signed-in user from Firebase, so a link tapped in the email shows up as
 * verified. Returns the fresh user, or null if signed out.
 */
export async function refreshUser(): Promise<AuthUser | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await reload(user);
  return toAuthUser(auth.currentUser);
}

/**
 * Sends a password reset email. Unknown emails are treated as success so the screen never
 * reveals who has an account.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, normalizeEmail(email));
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') return;
    throw error;
  }
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
  };
}
