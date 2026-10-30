/**
 * Test double for src/data/announcements.ts. Use with `jest.mock('@/data/announcements')`.
 * Posting and marking read update live subscribers.
 */
import type { ChapterAnnouncement, NewAnnouncement } from '../announcements';

let list: ChapterAnnouncement[] = [];
let reads = new Set<string>();
let failing = false;
const listListeners = new Set<(l: ChapterAnnouncement[]) => void>();
const readListeners = new Set<(r: ReadonlySet<string>) => void>();

export function sampleAnnouncement(
  overrides: Partial<ChapterAnnouncement> = {},
): ChapterAnnouncement {
  return {
    id: 'a1',
    title: 'Sample dues reminder',
    body: 'Sample. Use the link the Treasurer shared.',
    authorId: 'sample-kevin',
    authorTitle: 'Treasurer',
    pinned: false,
    createdAt: new Date(Date.now() - 3600_000),
    ...overrides,
  };
}

export function setMockAnnouncements(next: ChapterAnnouncement[]) {
  list = next;
  for (const l of listListeners) l(list);
}

export function setMockReads(ids: string[]) {
  reads = new Set(ids);
  for (const l of readListeners) l(reads);
}

export function failAnnouncementsLoad() {
  failing = true;
}

export const subscribeToAnnouncements = jest.fn(
  (onChange: (l: ChapterAnnouncement[]) => void, onError: (e: unknown) => void) => {
    if (failing) {
      failing = false;
      onError(new Error('offline'));
      return () => {};
    }
    listListeners.add(onChange);
    onChange(list);
    return () => {
      listListeners.delete(onChange);
    };
  },
);

export const subscribeToReads = jest.fn(
  (_uid: string, onChange: (r: ReadonlySet<string>) => void, _onError: (e: unknown) => void) => {
    readListeners.add(onChange);
    onChange(reads);
    return () => {
      readListeners.delete(onChange);
    };
  },
);

export const markRead = jest.fn(async (_uid: string, id: string) => {
  setMockReads([...reads, id]);
});

let counter = 0;
export const postAnnouncement = jest.fn(async (uid: string, input: NewAnnouncement) => {
  setMockAnnouncements([
    sampleAnnouncement({ id: `new-${++counter}`, ...input, authorId: uid, createdAt: new Date() }),
    ...list,
  ]);
});

export function resetAnnouncementsMock(initial: ChapterAnnouncement[] = []) {
  list = initial;
  reads = new Set();
  failing = false;
  counter = 0;
  listListeners.clear();
  readListeners.clear();
  for (const fn of [subscribeToAnnouncements, subscribeToReads, markRead, postAnnouncement]) {
    fn.mockClear();
  }
}
