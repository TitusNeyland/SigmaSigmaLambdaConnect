import { useCallback, useEffect, useState } from 'react';

import {
  fetchActivity,
  fetchProfilePosts,
  fetchProfileStats,
  subscribeToProfile,
  type ActivityItem,
  type Profile,
  type ProfilePost,
  type ProfileStats,
} from '@/data/profile';

export type Loadable<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error' };

/** Live profile document. Pass own for the signed-in member, to include contact settings. */
export function useProfile(uid: string, options: { own?: boolean } = {}): Loadable<Profile | null> {
  const own = options.own === true;
  const [result, setResult] = useState<{ uid: string; value: Loadable<Profile | null> } | null>(
    null,
  );
  useEffect(
    () =>
      subscribeToProfile(
        uid,
        (profile) => setResult({ uid, value: { state: 'ready', data: profile } }),
        () => setResult({ uid, value: { state: 'error' } }),
        { own },
      ),
    [uid, own],
  );
  return result && result.uid === uid ? result.value : { state: 'loading' };
}

/** Runs a one-off load, with reload for pull to refresh and retry. */
function useLoad<T>(key: string, load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const tag = `${key}:${attempt}`;
  const [result, setResult] = useState<{ tag: string; value: Loadable<T> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setResult({ tag, value: { state: 'ready', data } }),
      () => !cancelled && setResult({ tag, value: { state: 'error' } }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is rebuilt from `key`, so the tag covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const value: Loadable<T> = result && result.tag === tag ? result.value : { state: 'loading' };
  return { value, reload };
}

/**
 * Counts, posts and (when allowed) attendance for a profile. includeAttendance must only
 * be true for the member themself or an officer; the rules reject anyone else.
 */
export function useProfileExtras(uid: string, includeAttendance: boolean) {
  const key = `${uid}:${includeAttendance}`;
  const stats = useLoad<ProfileStats>(key, () => fetchProfileStats(uid, { includeAttendance }));
  const posts = useLoad<ProfilePost[]>(key, () => fetchProfilePosts(uid));
  const activity = useLoad<ActivityItem[] | null>(key, () =>
    includeAttendance ? fetchActivity(uid) : Promise.resolve(null),
  );

  const { reload: reloadStats } = stats;
  const { reload: reloadPosts } = posts;
  const { reload: reloadActivity } = activity;
  const reload = useCallback(() => {
    reloadStats();
    reloadPosts();
    reloadActivity();
  }, [reloadStats, reloadPosts, reloadActivity]);

  return { stats: stats.value, posts: posts.value, activity: activity.value, reload };
}
