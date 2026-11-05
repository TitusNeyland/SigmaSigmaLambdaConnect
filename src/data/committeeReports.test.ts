import { getDoc, getDocs, orderBy, setDoc, Timestamp, where } from 'firebase/firestore';
import { uploadBytesResumable } from 'firebase/storage';

import {
  fetchAllReports,
  fetchMyReports,
  fetchRecipients,
  safeFileName,
  saveRecipients,
  submitReport,
  toCommitteeReport,
  uploadReportFile,
} from './committeeReports';

// jest.setup.js mocks this module for screen tests; test the real one here.
jest.unmock('./committeeReports');
jest.mock('./firebase', () => ({ db: { name: 'db' }, storage: { name: 'storage' } }));
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    mockMs: number;
    constructor(ms: number) {
      this.mockMs = ms;
    }
    toDate() {
      return new Date(this.mockMs);
    }
  }
  return {
    Timestamp: MockTimestamp,
    collection: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/') })),
    doc: jest.fn((_db: unknown, ...s: string[]) => ({ path: s.join('/'), id: 'new-id' })),
    query: jest.fn((ref: object, ...parts: unknown[]) => ({ ...ref, parts })),
    where: jest.fn((...a: unknown[]) => ({ where: a })),
    orderBy: jest.fn((...a: unknown[]) => ({ orderBy: a })),
    limit: jest.fn((n: number) => ({ limit: n })),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    serverTimestamp: jest.fn(() => 'NOW'),
  };
});
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  getDownloadURL: jest.fn(),
  uploadBytesResumable: jest.fn(() => ({
    on: (_e: string, progress: (s: object) => void, _err: unknown, done: () => void) => {
      progress({ bytesTransferred: 5, totalBytes: 10 });
      done();
    },
  })),
}));

const ts = (ms: number) => new (Timestamp as unknown as new (ms: number) => Timestamp)(ms);
beforeEach(() => jest.clearAllMocks());

it('maps a report, and skips one without a committee or date', () => {
  expect(
    toCommitteeReport('r1', {
      authorId: 'chris',
      committee: ' Service ',
      period: 'Oct',
      summary: 'Did it',
      attachment: { path: 'committeeReports/chris/r1/a.pdf', name: 'a.pdf', size: 10 },
      emailStatus: 'sent',
      createdAt: ts(5),
    }),
  ).toEqual({
    id: 'r1',
    authorId: 'chris',
    authorName: null,
    committee: 'Service',
    period: 'Oct',
    summary: 'Did it',
    attachment: {
      path: 'committeeReports/chris/r1/a.pdf',
      name: 'a.pdf',
      contentType: '',
      size: 10,
    },
    emailStatus: 'sent',
    createdAt: new Date(5),
  });
  expect(
    toCommitteeReport('r', { committee: 'S', createdAt: ts(1), emailStatus: 'weird' }),
  ).toMatchObject({ emailStatus: null, attachment: null });
  expect(toCommitteeReport('r', { createdAt: ts(1) })).toBeNull();
  expect(toCommitteeReport('r', { committee: 'S' })).toBeNull();
});

it('keeps file names safe for Storage', () => {
  expect(safeFileName('Oct report (final).pdf')).toBe('Oct_report_final_.pdf');
  expect(safeFileName('   ')).toBe('file');
});

it('uploads the file under the member and report, reporting progress', async () => {
  global.fetch = jest.fn(async () => ({ blob: async () => ({ size: 2048 }) })) as never;
  const progress = jest.fn();
  const attachment = await uploadReportFile(
    'chris',
    'r1',
    { uri: 'file:///x.pdf', name: 'Oct report.pdf', mimeType: 'application/pdf', size: 0 },
    progress,
  );
  expect(attachment).toEqual({
    path: 'committeeReports/chris/r1/Oct_report.pdf',
    name: 'Oct report.pdf',
    contentType: 'application/pdf',
    size: 2048,
  });
  expect(jest.mocked(uploadBytesResumable).mock.calls[0][2]).toEqual({
    contentType: 'application/pdf',
  });
  expect(progress).toHaveBeenCalledWith(0.5);
  expect(progress).toHaveBeenLastCalledWith(1);
});

it('submits exactly the fields the rules allow', async () => {
  await submitReport(
    'chris',
    'r1',
    { committee: ' Service ', period: ' Oct ', summary: ' Did it ' },
    null,
  );
  expect(setDoc).toHaveBeenCalledWith(
    { path: 'committeeReports/r1', id: 'new-id' },
    {
      authorId: 'chris',
      committee: 'Service',
      period: 'Oct',
      summary: 'Did it',
      attachment: null,
      createdAt: 'NOW',
    },
  );
});

it('reads your own reports, or all of them, newest first', async () => {
  jest.mocked(getDocs).mockResolvedValue({
    docs: [{ id: 'r1', data: () => ({ committee: 'S', createdAt: ts(1) }) }],
  } as never);
  expect((await fetchMyReports('chris')).map((r) => r.id)).toEqual(['r1']);
  expect(where).toHaveBeenCalledWith('authorId', '==', 'chris');
  expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  jest.mocked(where).mockClear();
  await fetchAllReports();
  expect(where).not.toHaveBeenCalled();
});

it('reads and saves the recipients', async () => {
  jest.mocked(getDoc).mockResolvedValueOnce({ get: () => ['vp@example.com', 3] } as never);
  expect(await fetchRecipients()).toEqual(['vp@example.com']);
  jest.mocked(getDoc).mockResolvedValueOnce({ get: () => undefined } as never);
  expect(await fetchRecipients()).toEqual([]);
  await saveRecipients('adam', ['vp@example.com']);
  expect(setDoc).toHaveBeenCalledWith(
    { path: 'settings/reportRecipients', id: 'new-id' },
    { emails: ['vp@example.com'], updatedBy: 'adam', updatedAt: 'NOW' },
  );
});
