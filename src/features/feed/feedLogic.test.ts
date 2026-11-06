import type { FeedAuthor, FeedPost } from '@/data/feed';

import {
  appendPage,
  authorLine,
  captionPreview,
  commentsLabel,
  likesLabel,
  taggedParts,
  timeAgo,
  visiblePosts,
} from './feedLogic';

const author = (overrides: Partial<FeedAuthor> = {}): FeedAuthor => ({
  uid: 'm',
  displayName: 'Marcus Reed',
  photoURL: null,
  headline: 'Software engineer',
  initiationTerm: 'Spring 2019',
  role: null,
  ...overrides,
});

const post = (id: string, authorId = 'm', previewComments: FeedPost['previewComments'] = []) =>
  ({ id, authorId, previewComments }) as FeedPost;
const preview = (id: string, authorId: string) => ({
  id,
  authorId,
  authorName: 'Sample',
  text: 'Sample comment',
});

describe('authorLine', () => {
  it('reads like LinkedIn: role, initiation year, job', () => {
    expect(authorLine(author({ role: { role: 'officer', title: 'Treasurer' } }))).toBe(
      'Treasurer · Initiated 2019 · Software engineer',
    );
    expect(authorLine(author())).toBe('Initiated 2019 · Software engineer');
  });

  it('leaves out what’s missing and keeps an initiation term without a year', () => {
    expect(authorLine(author({ headline: '', initiationTerm: 'Founders line' }))).toBe(
      'Founders line',
    );
    expect(authorLine(author({ headline: '', initiationTerm: '' }))).toBe('');
  });
});

describe('timeAgo', () => {
  const NOW = new Date(2026, 9, 29, 18, 0);
  const ago = (ms: number) => timeAgo(new Date(NOW.getTime() - ms), NOW);
  it.each([
    [10_000, 'Just now'],
    [5 * 60_000, '5m'],
    [3 * 3600_000, '3h'],
    [2 * 86_400_000, '2d'],
  ])('%i ms ago is %s', (ms, label) => expect(ago(ms)).toBe(label));

  it('uses the date after a week, with the year when it’s different', () => {
    expect(timeAgo(new Date(2026, 9, 12), NOW)).toBe('Oct 12');
    expect(timeAgo(new Date(2025, 11, 31), NOW)).toBe('Dec 31, 2025');
  });

  it('treats a clock that runs a bit fast as just now', () => {
    expect(timeAgo(new Date(NOW.getTime() + 30_000), NOW)).toBe('Just now');
  });
});

describe('labels', () => {
  it('counts likes and comments', () => {
    expect(likesLabel(1)).toBe('1 like');
    expect(likesLabel(1200)).toBe('1,200 likes');
    expect(commentsLabel(0)).toBe('');
    expect(commentsLabel(1)).toBe('View 1 comment');
    expect(commentsLabel(14)).toBe('View all 14 comments');
  });

  it('trims long captions at a word', () => {
    const long = `${'word '.repeat(40)}end`;
    const preview = captionPreview(long);
    expect(preview.truncated).toBe(true);
    expect(preview.text.endsWith('word…')).toBe(true);
    expect(preview.text.length).toBeLessThanOrEqual(126);
    expect(captionPreview('  Short  ')).toEqual({ text: 'Short', truncated: false });
  });
});

describe('lists', () => {
  it('hides posts by blocked members', () => {
    expect(visiblePosts([post('a', 'x'), post('b', 'y')], new Set(['x'])).map((p) => p.id)).toEqual(
      ['b'],
    );
  });

  it('hides previewed comments from blocked members and ones the member reported', () => {
    const [shown] = visiblePosts(
      [post('a', 'm', [preview('c1', 'x'), preview('c2', 'y'), preview('c3', 'z')])],
      new Set(['x']),
      new Set(['comment_a_c3']),
    );
    expect(shown.previewComments.map((c) => c.id)).toEqual(['c2']);
  });

  it('adds the next page without repeating posts', () => {
    expect(appendPage([post('a'), post('b')], [post('b'), post('c')]).map((p) => p.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('taggedParts', () => {
  it('spells out up to three names, then two and how many others', () => {
    expect(taggedParts([])).toEqual({ shown: [], others: 0 });
    expect(taggedParts(['A', 'B', 'C'])).toEqual({ shown: ['A', 'B', 'C'], others: 0 });
    expect(taggedParts(['A', 'B', 'C', 'D', 'E'])).toEqual({ shown: ['A', 'B'], others: 3 });
  });
});
