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
