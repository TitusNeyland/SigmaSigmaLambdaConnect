import type { CommentPreview } from '@/data/types';

/** A tiny signal so Home reloads after the member shares a post elsewhere in the app. */
const listeners = new Set<() => void>();

export function onFeedChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyFeedChanged() {
  for (const l of listeners) l();
}

const reportedListeners = new Set<(what: 'post' | 'comment') => void>();

/** Lets the screen thank the member after a report, since the reported item hides itself. */
export function onReported(listener: (what: 'post' | 'comment') => void): () => void {
  reportedListeners.add(listener);
  return () => {
    reportedListeners.delete(listener);
  };
}

export function notifyReported(what: 'post' | 'comment') {
  for (const l of reportedListeners) l(what);
}

const blockedListeners = new Set<(name: string) => void>();

export function onBlocked(listener: (name: string) => void): () => void {
  blockedListeners.add(listener);
  return () => {
    blockedListeners.delete(listener);
  };
}

export function notifyBlocked(name: string) {
  for (const l of blockedListeners) l(name);
}

export type CommentsUpdate = { commentCount: number; previewComments: CommentPreview[] };

const commentsListeners = new Set<(postId: string, update: CommentsUpdate) => void>();

/**
 * Lets the feed show a post's live comment count and previews while its comments are open,
 * so a new comment shows up under the post right away.
 */
export function onCommentsChanged(
  listener: (postId: string, update: CommentsUpdate) => void,
): () => void {
  commentsListeners.add(listener);
  return () => {
    commentsListeners.delete(listener);
  };
}

export function notifyCommentsChanged(postId: string, update: CommentsUpdate) {
  for (const l of commentsListeners) l(postId, update);
}
