/** Test double for src/data/moderation.ts. Use with `jest.mock('@/data/moderation')`. */
import type { ReportAction, ReportCase } from '../moderation';

export const RESTRICT_DAYS = 7;

let cases: ReportCase[] = [];
let restriction: Date | null = null;
let failingLoad = false;
let failingAction = false;
let counter = 0;

export function sampleCase(overrides: Partial<ReportCase> = {}): ReportCase {
  return {
    key: 'post_sample-post',
    targetType: 'post',
    postId: 'sample-post',
    commentId: null,
    authorId: 'sample-author',
    authorName: 'Sample Author',
    authorPhotoURL: null,
    preview: { text: 'Sample reported caption', photoPath: null, photoCount: 0 },
    reasons: [
      { reason: 'spam', count: 2 },
      { reason: 'harassment', count: 1 },
    ],
    details: ['Sample detail from a reporter'],
    count: 3,
    latestAt: new Date(Date.now() - 3600_000),
    reportIds: ['r1', 'r2', 'r3'],
    ...overrides,
  };
}

export function setMockCases(next: ReportCase[]) {
  cases = next;
}
export function setMockRestriction(until: Date | null) {
  restriction = until;
}
export function failQueueLoad() {
  failingLoad = true;
}
export function failNextAction() {
  failingAction = true;
}

export const fetchReportQueue = jest.fn(async () => {
  if (failingLoad) {
    failingLoad = false;
    throw new Error('offline');
  }
  return cases;
});

export const resolveReportCase = jest.fn(async (_ids: string[], _action: ReportAction) => {
  if (failingAction) {
    failingAction = false;
    throw new Error('offline');
  }
  return `decision-${++counter}`;
});

export const undoReportDecision = jest.fn(async (_decisionId: string) => {
  if (failingAction) {
    failingAction = false;
    throw new Error('offline');
  }
});

export const fetchMyRestriction = jest.fn(async (_uid: string) => restriction);

export function resetModerationMock() {
  cases = [];
  restriction = null;
  failingLoad = false;
  failingAction = false;
  counter = 0;
  for (const fn of [fetchReportQueue, resolveReportCase, undoReportDecision, fetchMyRestriction]) {
    fn.mockClear();
  }
}
