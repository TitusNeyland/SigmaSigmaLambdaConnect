import type { RoleDoc } from '@/data/types';

/** What someone can do in the app, from least to most. */
export type AccessLevel = 'member' | 'officer' | 'admin';

/**
 * Things the UI shows or hides by role. Each one matches what the security rules allow,
 * so hiding a tool never stands in for enforcing it.
 */
export type Capability =
  | 'leadership.view'
  | 'members.approve'
  | 'events.manage'
  | 'attendance.take'
  | 'announcements.post'
  | 'reports.review'
  | 'programs.manage'
  | 'roles.manage';

const OFFICER: readonly Capability[] = [
  'leadership.view',
  'members.approve',
  'events.manage',
  'attendance.take',
  'announcements.post',
  'reports.review',
  'programs.manage',
];

const CAPABILITIES: Record<AccessLevel, ReadonlySet<Capability>> = {
  member: new Set(),
  officer: new Set(OFFICER),
  admin: new Set([...OFFICER, 'roles.manage']),
};

export function accessLevelFor(role: RoleDoc | null | undefined): AccessLevel {
  return role?.role ?? 'member';
}

export function can(level: AccessLevel, capability: Capability): boolean {
  return CAPABILITIES[level].has(capability);
}

/** How a role reads on a profile or badge: the officer title if there is one. */
export function roleLabel(role: RoleDoc | null | undefined): string {
  if (!role) return 'Member';
  if (role.title) return role.title;
  return role.role === 'admin' ? 'Admin' : 'Officer';
}
