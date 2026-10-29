import { addDoc, collection } from 'firebase/firestore';

import { REPORT_REASONS, reportMember } from './reports';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'NOW'),
}));

beforeEach(() => jest.clearAllMocks());

it('files a member report with exactly the fields the rules allow', async () => {
  await reportMember('me', 'them', 'harassment');
  expect(collection).toHaveBeenCalledWith({ name: 'db' }, 'reports');
  expect(addDoc).toHaveBeenCalledWith(
    { collection: 'reports' },
    {
      reporterId: 'me',
      targetType: 'member',
      targetAuthorId: 'them',
      reason: 'harassment',
      status: 'open',
      createdAt: 'NOW',
    },
  );
});

it('lists the four reasons the rules accept', () => {
  expect(REPORT_REASONS.map((r) => r.value)).toEqual([
    'spam',
    'harassment',
    'inappropriate',
    'other',
  ]);
});
