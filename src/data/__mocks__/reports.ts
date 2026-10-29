/** Test double for src/data/reports.ts. Use with `jest.mock('@/data/reports')`. */
export { REPORT_REASONS, type ReportReason } from '../types';

export const reportMember = jest.fn(
  async (_reporterId: string, _memberId: string, _reason: string) => {},
);

export function resetReportsMock() {
  reportMember.mockReset().mockResolvedValue(undefined);
}
