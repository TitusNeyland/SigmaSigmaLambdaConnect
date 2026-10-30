import type { ChapterAnnouncement } from '@/data/announcements';

import { canPost, sortAnnouncements, unreadCount } from './announcementLogic';

const a = (id: string, pinned: boolean, at: number) =>
  ({ id, pinned, createdAt: new Date(at) }) as ChapterAnnouncement;

it('puts pinned first, then newest', () => {
  expect(
    sortAnnouncements([a('old', false, 1), a('pin', true, 0), a('new', false, 9)]).map((x) => x.id),
  ).toEqual(['pin', 'new', 'old']);
});

it('counts unread', () => {
  expect(unreadCount([a('1', false, 1), a('2', false, 2)], new Set(['1']))).toBe(1);
});

it('needs a title and a message within limits', () => {
  expect(canPost('Dues', 'Pay by Friday')).toBe(true);
  expect(canPost('  ', 'x')).toBe(false);
  expect(canPost('x', '  ')).toBe(false);
  expect(canPost('x'.repeat(101), 'x')).toBe(false);
  expect(canPost('x', 'x'.repeat(2001))).toBe(false);
});
