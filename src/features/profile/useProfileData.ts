import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * Runs a one-off load, with reload for pull to refresh, retry and coming back to the
 * screen. While reloading, what was already loaded for the same key stays on screen, so a
 * refresh doesn't flash "Loading…".
 */
function useLoad<T>(key: string, load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const tag = `${key}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    tag: string;
    value: Loadable<T>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setResult({ key, tag, value: { state: 'ready', data } }),
      () => !cancelled && setResult({ key, tag, value: { state: 'error' } }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is rebuilt from `key`, so the tag covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const current = result && result.tag === tag;
  const stale = result && result.key === key && result.value.state === 'ready';
  const value: Loadable<T> = current || stale ? result.value : { state: 'loading' };
  return { value, reload };
}

/**
 * Counts, posts and (when allowed) attendance for a profile. includeAttendance must only
 * be true for the member themself or an officer; the rules reject anyone else.
 */
export function useProfileExtras(uid: string, includeAttendance: boolean) {
  const key = `${uid}:${includeAttendance}`;
  const stats = useLoad<ProfileStats>(key, () => fetchProfileStats(uid));
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

  // Coming back to the profile (say, after deleting a post you opened from it) reloads it.
  // The first focus is the first load, which has already started.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload();
      focusedBefore.current = true;
    }, [reload]),
  );

  return { stats: stats.value, posts: posts.value, activity: activity.value, reload };
}
