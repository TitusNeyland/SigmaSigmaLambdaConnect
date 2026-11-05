/**
 * Test double for src/data/activity.ts. jest.setup.js mocks it for every app test, since
 * Home loads it. Set items with `resetActivityMock`, and when they last looked with
 * `setMockSeen`.
 */
import type { ActivityItem } from '../activity';

let items: ActivityItem[] = [];
let seen: Date | null = null;
let failing = false;

export function sampleActivity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'like_p1_sample-chris',
    type: 'like',
    actorId: 'sample-chris',
    actorName: 'Sample Chris',
    actorPhotoURL: null,
    postId: 'p1',
    commentId: null,
    text: '',
    photoPath: null,
    at: new Date(Date.now() - 3600_000),
    ...overrides,
  };
}

export function resetActivityMock(next: ActivityItem[] = []) {
  items = next;
  seen = null;
  failing = false;
  fetchActivity.mockClear();
  markActivitySeen.mockClear();
}

export function setMockSeen(date: Date | null) {
  seen = date;
}

export function failActivityLoad() {
  failing = true;
}

export const ACTIVITY_LIMIT = 50;

export const fetchActivity = jest.fn(async (_uid: string, max = ACTIVITY_LIMIT) => {
  if (failing) {
    failing = false;
    throw new Error('offline');
  }
  return items.slice(0, max);
});

export const fetchActivitySeen = jest.fn(async (_uid: string) => seen);

export const markActivitySeen = jest.fn(async (_uid: string) => {
  seen = new Date();
});
