import { useRef, useState } from 'react';

import { likePost, unlikePost } from '@/data/likes';

/** The like button's state: flips at once, then saves; puts it back if saving fails. */
export function useLike(postId: string, uid: string, initial: { liked: boolean; count: number }) {
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  // A ref, so two quick taps in the same frame can't both start a save.
  const inFlight = useRef(false);
  const [failed, setFailed] = useState(false);

  // A refreshed feed brings new numbers from the server; take them unless a save is running.
  const serverKey = `${initial.liked}:${initial.count}`;
  const [seen, setSeen] = useState(serverKey);
  if (serverKey !== seen && !saving) {
    setSeen(serverKey);
    setState(initial);
  }

  async function toggle() {
    if (inFlight.current || !uid) return;
    inFlight.current = true;
    const before = state;
    const liked = !before.liked;
    setState({ liked, count: Math.max(0, before.count + (liked ? 1 : -1)) });
    setSaving(true);
    setFailed(false);
    try {
      await (liked ? likePost(postId, uid) : unlikePost(postId, uid));
    } catch {
      setState(before);
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  /** Double-tapping a photo only ever likes, like Instagram. */
  function like() {
    if (!state.liked) void toggle();
  }

  return { ...state, failed, toggle, like };
}
