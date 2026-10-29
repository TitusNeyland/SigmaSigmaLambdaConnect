/**
 * Test double for src/data/profile.ts. Use with `jest.mock('@/data/profile')`, then set what
 * the profile screen sees with `setMockProfile` and `setMockExtras`.
 */
import type { ActivityItem, Profile, ProfilePost, ProfileStats } from '../profile';

let profile: Profile | null = null;
let stats: ProfileStats = { posts: 0, eventsAttended: 0, serviceHours: 0 };
let posts: ProfilePost[] = [];
let activity: ActivityItem[] = [];
let failExtras = false;
const listeners = new Set<(p: Profile | null) => void>();

export function sampleProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    displayName: 'Marcus Reed',
    initiationTerm: 'Spring 2019',
    headline: 'Software engineer',
    bio: 'Mentoring chair. Happy to review a resume.',
    interests: ['Tech', 'Career mentoring'],
    photoURL: null,
    ...overrides,
  };
}

export function setMockProfile(next: Profile | null) {
  profile = next;
  for (const l of listeners) l(next);
}

export function setMockExtras(next: {
  stats?: ProfileStats;
  posts?: ProfilePost[];
  activity?: ActivityItem[];
  fail?: boolean;
}) {
  if (next.stats) stats = next.stats;
  if (next.posts) posts = next.posts;
  if (next.activity) activity = next.activity;
  if (next.fail !== undefined) failExtras = next.fail;
}

export const subscribeToProfile = jest.fn(
  (_uid: string, onChange: (p: Profile | null) => void, _onError: (e: unknown) => void) => {
    listeners.add(onChange);
    onChange(profile);
    return () => {
      listeners.delete(onChange);
    };
  },
);

const rejectIfFailing = <T>(value: T) =>
  failExtras ? Promise.reject(new Error('offline')) : Promise.resolve(value);

export const fetchProfileStats = jest.fn(
  async (_uid: string, options: { includeAttendance: boolean }) =>
    rejectIfFailing<ProfileStats>(
      options.includeAttendance ? stats : { ...stats, eventsAttended: null, serviceHours: null },
    ),
);
export const fetchProfilePosts = jest.fn(async () => rejectIfFailing(posts));
export const fetchActivity = jest.fn(async () => rejectIfFailing(activity));
export const photoUrl = jest.fn(async (path: string) => `https://example.test/${path}`);

export function resetProfileMock(initial: Profile | null = sampleProfile()) {
  profile = initial;
  stats = { posts: 0, eventsAttended: 0, serviceHours: 0 };
  posts = [];
  activity = [];
  failExtras = false;
  listeners.clear();
  for (const fn of [
    subscribeToProfile,
    fetchProfileStats,
    fetchProfilePosts,
    fetchActivity,
    photoUrl,
  ]) {
    fn.mockClear();
  }
}

resetProfileMock();
