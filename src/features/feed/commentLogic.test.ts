import type { PostComment } from '@/data/comments';

import { canPostComment, threadComments } from './commentLogic';

const c = (id: string, replyToId: string | null = null, authorId = 'a') =>
  ({ id, replyToId, authorId }) as PostComment;
const order = (rows: ReturnType<typeof threadComments>) =>
  rows.map((r) => `${r.isReply ? '  ' : ''}${r.comment.id}`);

describe('threadComments', () => {
  it('puts replies under the comment they answer, one level deep', () => {
    expect(order(threadComments([c('1'), c('2'), c('3', '1'), c('4', '3'), c('5', '2')]))).toEqual([
      '1',
      '  3',
      '  4',
      '2',
      '  5',
    ]);
  });

  it('shows a reply to a deleted comment as its own comment', () => {
    expect(order(threadComments([c('2', 'gone'), c('3')]))).toEqual(['2', '3']);
  });

  it('hides blocked members, and their replies thread to what’s left', () => {
    expect(
      order(
        threadComments([c('1', null, 'x'), c('2', '1', 'a'), c('3', null, 'a')], new Set(['x'])),
      ),
    ).toEqual(['2', '3']);
  });

  it('survives a loop of replies', () => {
    expect(order(threadComments([c('1', '2'), c('2', '1')])).length).toBe(2);
  });
});

it('needs some words, up to 1000 characters', () => {
  expect(canPostComment('  ')).toBe(false);
  expect(canPostComment(' Nice ')).toBe(true);
  expect(canPostComment('a'.repeat(1000))).toBe(true);
  expect(canPostComment('a'.repeat(1001))).toBe(false);
});
