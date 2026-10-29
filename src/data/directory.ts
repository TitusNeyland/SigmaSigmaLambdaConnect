import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { db } from './firebase';
import { parseRoleDoc } from './roles';
import type { RoleDoc } from './types';

/** One approved member as the directory shows them. */
export type DirectoryEntry = {
  uid: string;
  displayName: string;
  headline: string;
  initiationTerm: string;
  interests: string[];
  photoURL: string | null;
  role: RoleDoc | null;
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Chapter-sized cap. A chapter has dozens of members, not thousands. */
const MAX_MEMBERS = 500;

/**
 * Every approved member with their role. Pending and declined accounts never appear.
 * Two reads: approved members, then the roles collection (small; officers only).
 */
export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const [members, roles] = await Promise.all([
    getDocs(
      query(collection(db, 'members'), where('status', '==', 'approved'), limit(MAX_MEMBERS)),
    ),
    getDocs(collection(db, 'roles')),
  ]);
  const roleByUid = new Map<string, RoleDoc>();
  for (const d of roles.docs) {
    const role = parseRoleDoc(d.data());
    if (role) roleByUid.set(d.id, role);
  }
  return members.docs
    .map((d) => {
      const data = d.data();
      const displayName = text(data.displayName).trim();
      return {
        uid: d.id,
        displayName,
        headline: text(data.headline).trim(),
        initiationTerm: text(data.initiationTerm).trim(),
        interests: Array.isArray(data.interests)
          ? data.interests.filter((i): i is string => typeof i === 'string' && i.trim() !== '')
          : [],
        photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
        role: roleByUid.get(d.id) ?? null,
      };
    })
    .filter((entry) => entry.displayName !== '');
}
