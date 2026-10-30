/**
 * Test double for src/data/reports.ts. Use with `jest.mock('@/data/reports')`. Reporting
 * content hides it for live subscribers, like the real batch write.
 */
import type { ContentReport } from '../reports';

export { REPORT_REASONS, type ReportReason } from '../types';

export const hiddenKey = (r: Pick<ContentReport, 'targetType' | 'postId' | 'commentId'>) =>
  r.targetType === 'post' ? `post_${r.postId}` : `comment_${r.postId}_${r.commentId}`;

let hidden = new Set<string>();
const listeners = new Set<(keys: ReadonlySet<string>) => void>();

export function setMockHidden(keys: string[]) {
  hidden = new Set(keys);
  for (const l of listeners) l(hidden);
}

export const reportMember = jest.fn(
  async (_reporterId: string, _memberId: string, _reason: string) => {},
);

export const reportContent = jest.fn(async (_reporterId: string, report: ContentReport) => {
  setMockHidden([...hidden, hiddenKey(report)]);
});

export const subscribeToHidden = jest.fn(
  (_uid: string, onChange: (keys: ReadonlySet<string>) => void, _onError: (e: unknown) => void) => {
    listeners.add(onChange);
    onChange(hidden);
    return () => {
      listeners.delete(onChange);
    };
  },
);

export function resetReportsMock() {
  hidden = new Set();
  listeners.clear();
  reportMember.mockReset().mockResolvedValue(undefined);
  reportContent.mockClear();
  subscribeToHidden.mockClear();
}
