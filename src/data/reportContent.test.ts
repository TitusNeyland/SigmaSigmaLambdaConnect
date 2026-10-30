import { onSnapshot, writeBatch } from 'firebase/firestore';

import { hiddenKey, reportContent, subscribeToHidden } from './reports';

jest.mock('./firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...s: string[]) => ({ collection: s.join('/') })),
  doc: jest.fn((parent: { collection?: string }, ...s: string[]) =>
    s.length ? { path: s.join('/') } : { path: `${parent.collection}/auto` },
  ),
  addDoc: jest.fn(),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => 'NOW'),
}));

const batch = { set: jest.fn(), commit: jest.fn(async () => {}) };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(writeBatch).mockReturnValue(batch as never);
});

it('keys hidden posts and comments', () => {
  expect(hiddenKey({ targetType: 'post', postId: 'p1' })).toBe('post_p1');
  expect(hiddenKey({ targetType: 'comment', postId: 'p1', commentId: 'c1' })).toBe('comment_p1_c1');
});

it('files the report and hides a post for the reporter in one write', async () => {
  await reportContent('me', {
    targetType: 'post',
    postId: 'p1',
    targetAuthorId: 'them',
    reason: 'spam',
  });
  expect(batch.set).toHaveBeenCalledWith(
    { path: 'reports/auto' },
    {
      reporterId: 'me',
      targetType: 'post',
      postId: 'p1',
      targetAuthorId: 'them',
      reason: 'spam',
      status: 'open',
      createdAt: 'NOW',
    },
  );
  expect(batch.set).toHaveBeenCalledWith(
    { path: 'hidden/me/items/post_p1' },
    { targetType: 'post', postId: 'p1', createdAt: 'NOW' },
  );
  expect(batch.commit).toHaveBeenCalledTimes(1);
});

it('includes the comment for a comment report', async () => {
  await reportContent('me', {
    targetType: 'comment',
    postId: 'p1',
    commentId: 'c1',
    targetAuthorId: 'them',
    reason: 'harassment',
  });
  expect(batch.set).toHaveBeenCalledWith(
    { path: 'reports/auto' },
    expect.objectContaining({ targetType: 'comment', commentId: 'c1' }),
  );
  expect(batch.set).toHaveBeenCalledWith(
    { path: 'hidden/me/items/comment_p1_c1' },
    { targetType: 'comment', postId: 'p1', commentId: 'c1', createdAt: 'NOW' },
  );
});

it('lists what the member hid', () => {
  const onChange = jest.fn();
  subscribeToHidden('me', onChange, jest.fn());
  const next = jest.mocked(onSnapshot).mock.calls[0][1] as unknown as (s: object) => void;
  next({ docs: [{ id: 'post_p1' }, { id: 'comment_p1_c1' }] });
  expect(onChange).toHaveBeenCalledWith(new Set(['post_p1', 'comment_p1_c1']));
});
