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
