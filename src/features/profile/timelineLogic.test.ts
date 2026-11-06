import type { EventSummary } from '@/data/events';
import type { ActivityItem, ProfilePost } from '@/data/profile';

import { buildTimeline, MAX_RECENT } from './timelineLogic';

const now = new Date(2026, 10, 6, 12);
const day = (m: number, d: number, y = 2026) => new Date(y, m, d);

const event = (id: string, startsAt: Date, extra: Partial<EventSummary> = {}): EventSummary => ({
  id,
  title: `Sample ${id}`,
  category: 'meeting',
  description: '',
  startsAt,
  endsAt: null,
  location: 'Sample hall',
  photoURL: null,
  cancelled: false,
  myRsvp: 'going',
  slots: null,
  goingCount: null,
  ...extra,
});
const checkIn = (eventId: string, startsAt: Date | null, serviceHours = 0): ActivityItem => ({
  eventId,
  title: `Sample ${eventId}`,
  startsAt,
  location: 'Sample hall',
  serviceHours,
});
const post = (
  id: string,
  createdAt: Date | null,
  extra: Partial<ProfilePost> = {},
): ProfilePost => ({
  id,
  coverPath: null,
  photoCount: 0,
  caption: ` Caption ${id} `,
  createdAt,
  ...extra,
});

const empty = {
  attended: [] as ActivityItem[] | null,
  posts: [] as ProfilePost[],
  tagged: [] as ProfilePost[],
  upcoming: [] as EventSummary[],
  initiationDate: null as Date | null,
  now,
};
const keys = (items: { key: string }[]) => items.map((i) => i.key);

it('lists events he’s going to, soonest first, leaving out maybes and cancelled ones', () => {
  const { upcoming } = buildTimeline({
    ...empty,
    upcoming: [
      event('late', day(11, 1)),
      event('soon', day(10, 8)),
      event('maybe', day(10, 9), { myRsvp: 'maybe' }),
      event('off', day(10, 10), { cancelled: true }),
    ],
  });
  expect(keys(upcoming)).toEqual(['going-soon', 'going-late']);
});

it('mixes check-ins, posts, tags and anniversaries, newest first', () => {
  const { recent } = buildTimeline({
    ...empty,
    attended: [checkIn('drive', day(9, 12), 4), checkIn('undated', null)],
    posts: [post('p1', day(10, 2))],
    tagged: [
      post('t1', day(9, 20), {
        author: { uid: 'a', displayName: 'Sample Brother', photoURL: null },
      }),
    ],
    initiationDate: day(10, 1, 2024),
  });
  expect(keys(recent)).toEqual([
    'posted-p1',
    'initiated-2',
    'tagged-t1',
    'attended-drive',
    'initiated-1',
    'initiated-0',
    'attended-undated',
  ]);
  expect(recent.find((i) => i.key === 'posted-p1')).toMatchObject({ caption: 'Caption p1' });
  expect(recent.find((i) => i.key === 'tagged-t1')).toMatchObject({ by: 'Sample Brother' });
  expect(recent.find((i) => i.key === 'attended-drive')).toMatchObject({ serviceHours: 4 });
});

it('leaves out check-ins when the viewer can’t see them', () => {
  const { recent } = buildTimeline({ ...empty, attended: null, posts: [post('p1', day(10, 2))] });
  expect(keys(recent)).toEqual(['posted-p1']);
});

it('shows an event under way he’s checked in at once, as attended', () => {
  const { upcoming, recent } = buildTimeline({
    ...empty,
    attended: [checkIn('now', day(10, 6))],
    upcoming: [event('now', day(10, 6))],
  });
  expect(upcoming).toEqual([]);
  expect(keys(recent)).toEqual(['attended-now']);
});

it('counts line anniversaries up to today, not this year’s if it hasn’t come yet', () => {
  const { recent } = buildTimeline({ ...empty, initiationDate: day(11, 20, 2023) });
  expect(recent.map((i) => (i.kind === 'initiated' ? i.years : -1))).toEqual([2, 1, 0]);
  expect(buildTimeline({ ...empty, initiationDate: day(11, 20, 2026) }).recent).toEqual([]);
});

it('keeps the list to a sensible length', () => {
  const many = Array.from({ length: MAX_RECENT + 10 }, (_, i) => post(`p${i}`, day(0, 1 + i)));
  expect(buildTimeline({ ...empty, posts: many }).recent).toHaveLength(MAX_RECENT);
});
