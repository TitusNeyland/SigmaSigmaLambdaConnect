/** Overall progress across all photos, each counting the same. 0 to 100. */
export function overallPercent(progress: number[], total: number): number {
  if (total <= 0) return 0;
  const sum = progress.slice(0, total).reduce((a, p) => a + Math.min(1, Math.max(0, p)), 0);
  return Math.round((sum / total) * 100);
}

/** "Uploading 2 of 5" while photos go up, then "Sharing…" for the post itself. */
export function uploadLabel(done: number, total: number): string {
  if (total === 0 || done >= total) return 'Sharing…';
  return `Uploading ${done + 1} of ${total}`;
}
