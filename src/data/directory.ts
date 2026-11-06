import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { db } from './firebase';
import { parseRoleDoc } from './roles';
import type { RoleDoc } from './types';

/** One approved member as the directory shows them. */
export type DirectoryEntry = {
  uid: string;
  displayName: string;
  headline: string;
  /** His line of work, like Real estate. Empty if he didn't say. */
  industry: string;
  /** The city he lives in, if he added it. */
  city: string;
  /** Businesses he owns. */
  businesses: string[];
  initiationTerm: string;
  /** The day they crossed, if they added it. */
  initiationDate: Date | null;
  interests: string[];
  photoURL: string | null;
  role: RoleDoc | null;
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const textList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((i): i is string => typeof i === 'string' && i.trim() !== '')
        .map((i) => i.trim())
    : [];

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
        industry: text(data.industry).trim(),
        city: text(data.city).trim(),
        businesses: textList(data.businesses),
        initiationTerm: text(data.initiationTerm).trim(),
        initiationDate:
          typeof data.initiationDate?.toDate === 'function'
            ? (data.initiationDate.toDate() as Date)
            : null,
        interests: textList(data.interests),
        photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : null,
        role: roleByUid.get(d.id) ?? null,
      };
    })
    .filter((entry) => entry.displayName !== '');
}
