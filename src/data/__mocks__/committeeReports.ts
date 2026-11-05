/**
 * Test double for src/data/committeeReports.ts. jest.setup.js mocks it for every app test,
 * since the Chapter routes load it. Seed reports with `resetCommitteeReportsMock` and
 * recipients with `setMockRecipients`; submitted reports are added to the list.
 */
import type { CommitteeReport, LocalFile, NewReport, ReportAttachment } from '../committeeReports';

let reports: CommitteeReport[] = [];
let recipients: string[] = [];
let failLoad = false;
let failSubmit = false;
let nextId = 1;

export function sampleReport(overrides: Partial<CommitteeReport> = {}): CommitteeReport {
  return {
    id: 'r1',
    authorId: 'sample-chris',
    authorName: 'Sample Chris',
    committee: 'Service',
    period: 'October 2026',
    summary: 'Sample. Two park cleanups and a food drive.',
    attachment: null,
    emailStatus: 'sent',
    createdAt: new Date(Date.now() - 86_400_000),
    ...overrides,
  };
}

export function resetCommitteeReportsMock(next: CommitteeReport[] = []) {
  reports = next;
  recipients = [];
  failLoad = false;
  failSubmit = false;
  nextId = 1;
  for (const fn of [
    fetchMyReports,
    fetchAllReports,
    fetchReport,
    submitReport,
    uploadReportFile,
    saveRecipients,
    fetchRecipients,
  ]) {
    fn.mockClear();
  }
}

export function setMockRecipients(next: string[]) {
  recipients = next;
}

export function failReportsLoad() {
  failLoad = true;
}

export function failNextSubmit() {
  failSubmit = true;
}

function load<T>(value: T): T {
  if (failLoad) {
    failLoad = false;
    throw new Error('offline');
  }
  return value;
}

export const REPORTS_LIMIT = 50;

export const newReportId = jest.fn(() => `new-${nextId++}`);

export const safeFileName = (name: string) => name.replace(/[^\w.-]+/g, '_') || 'file';

export const uploadReportFile = jest.fn(
  async (uid: string, reportId: string, file: LocalFile): Promise<ReportAttachment> => ({
    path: `committeeReports/${uid}/${reportId}/${safeFileName(file.name)}`,
    name: file.name,
    contentType: file.mimeType,
    size: file.size,
  }),
);

export const submitReport = jest.fn(
  async (uid: string, id: string, report: NewReport, attachment: ReportAttachment | null) => {
    if (failSubmit) {
      failSubmit = false;
      throw new Error('offline');
    }
    reports = [
      {
        id,
        authorId: uid,
        authorName: null,
        ...report,
        attachment,
        emailStatus: null,
        createdAt: new Date(),
      },
      ...reports,
    ];
  },
);

export const fetchMyReports = jest.fn(async (uid: string) =>
  load(reports.filter((r) => r.authorId === uid)),
);

export const fetchAllReports = jest.fn(async () => load(reports));

export const fetchReport = jest.fn(async (id: string) =>
  load(reports.find((r) => r.id === id) ?? null),
);

export const reportFileUrl = jest.fn(async (path: string) => `https://example.test/${path}`);

export const fetchRecipients = jest.fn(async () => load(recipients));

export const saveRecipients = jest.fn(async (_uid: string, emails: string[]) => {
  recipients = emails;
});
