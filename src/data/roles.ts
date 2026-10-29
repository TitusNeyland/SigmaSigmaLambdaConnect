import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from './firebase';
import type { Role, RoleDoc } from './types';

const ROLES: readonly Role[] = ['officer', 'admin'];
const MAX_TITLE = 40;

/** Reads a roles document defensively. Anything unexpected is treated as no role. */
export function parseRoleDoc(data: Record<string, unknown> | undefined): RoleDoc | null {
  if (!data || !ROLES.includes(data.role as Role)) return null;
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  return title ? { role: data.role as Role, title } : { role: data.role as Role };
}

/**
 * Listens to someone's role. Calls back with null when they have no roles document, which
 * means a regular member.
 */
export function subscribeToRole(
  uid: string,
  onChange: (role: RoleDoc | null) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'roles', uid),
    (snap) => onChange(snap.exists() ? parseRoleDoc(snap.data()) : null),
    onError,
  );
}

/**
 * Makes someone an officer or admin. Admins only: the security rules reject everyone else.
 * An empty title is left off.
 */
export async function setRole(uid: string, input: RoleDoc): Promise<void> {
  if (!ROLES.includes(input.role)) throw new Error(`Unknown role: ${String(input.role)}`);
  const title = input.title?.trim() ?? '';
  if (title.length > MAX_TITLE) throw new Error(`Titles are ${MAX_TITLE} characters or fewer.`);
  await setDoc(doc(db, 'roles', uid), title ? { role: input.role, title } : { role: input.role });
}

/** Turns someone back into a regular member. Admins only. */
export async function removeRole(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'roles', uid));
}
