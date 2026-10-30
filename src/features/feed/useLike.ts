import { useRef, useState } from 'react';

import { likeComment, unlikeComment } from '@/data/comments';
import { likePost, unlikePost } from '@/data/likes';

type Initial = { liked: boolean; count: number };

/**
 * A like button's state: flips at once, then saves; puts it back if saving fails. Used for
 * posts and comments.
 */
export function useLikeToggle(
  save: (liked: boolean) => Promise<void>,
  enabled: boolean,
  initial: Initial,
) {
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  // A ref, so two quick taps in the same frame can't both start a save.
  const inFlight = useRef(false);
  const [failed, setFailed] = useState(false);

  // Fresh numbers from the server win, unless a save is running.
  const serverKey = `${initial.liked}:${initial.count}`;
  const [seen, setSeen] = useState(serverKey);
  if (serverKey !== seen && !saving) {
    setSeen(serverKey);
    setState(initial);
  }

  async function toggle() {
    if (inFlight.current || !enabled) return;
    inFlight.current = true;
    const before = state;
    const liked = !before.liked;
    setState({ liked, count: Math.max(0, before.count + (liked ? 1 : -1)) });
    setSaving(true);
    setFailed(false);
    try {
      await save(liked);
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

export function useLike(postId: string, uid: string, initial: Initial) {
  return useLikeToggle(
    (liked) => (liked ? likePost(postId, uid) : unlikePost(postId, uid)),
    !!uid,
    initial,
  );
}

export function useCommentLike(postId: string, commentId: string, uid: string, initial: Initial) {
  return useLikeToggle(
    (liked) =>
      liked ? likeComment(postId, commentId, uid) : unlikeComment(postId, commentId, uid),
    !!uid,
    initial,
  );
}
