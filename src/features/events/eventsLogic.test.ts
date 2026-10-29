import type { EventSummary } from '@/data/events';

import {
  arrangeEvents,
  dateBlock,
  deadlineText,
  emptyMessage,
  eventMeta,
  formatDay,
  formatFee,
  formatTime,
  formatTimeRange,
  goingSummary,
  matchesSearch,
} from './eventsLogic';

const NOW = new Date(2026, 9, 29, 12, 0); // Thu, Oct 29 2026, noon

const event = (overrides: Partial<EventSummary>): EventSummary => ({
  id: overrides.title ?? 'e',
  title: 'Event',
  category: 'meeting',
  description: '',
  startsAt: new Date(2026, 10, 7, 19, 0),
  endsAt: null,
  location: '',
  photoURL: null,
  cancelled: false,
  myRsvp: null,
  ...overrides,
});

describe('formatting', () => {
  it.each([
    [new Date(2026, 0, 1, 0, 5), '12:05 AM'],
    [new Date(2026, 0, 1, 9, 0), '9:00 AM'],
    [new Date(2026, 0, 1, 12, 30), '12:30 PM'],
    [new Date(2026, 0, 1, 19, 0), '7:00 PM'],
  ])('formatTime(%s) is %s', (date, expected) => expect(formatTime(date)).toBe(expected));

  it('names today and tomorrow, then the weekday and date', () => {
    expect(formatDay(new Date(2026, 9, 29, 20), NOW)).toBe('Today');
    expect(formatDay(new Date(2026, 9, 30, 8), NOW)).toBe('Tomorrow');
    expect(formatDay(new Date(2026, 10, 7, 19), NOW)).toBe('Sat, Nov 7');
  });

  it('builds the date block', () => {
    expect(dateBlock(new Date(2026, 10, 7))).toEqual({ month: 'NOV', day: '7' });
  });

  it('builds the meta line, leaving out a missing place', () => {
    expect(eventMeta(event({ location: 'Chapter house' }), NOW)).toBe(
      'Sat, Nov 7 · 7:00 PM · Chapter house',
    );
    expect(eventMeta(event({}), NOW)).toBe('Sat, Nov 7 · 7:00 PM');
  });
});

describe('search', () => {
  const service = event({
    title: 'Park cleanup',
    location: 'Riverside Park',
    description: 'Sample service day with the youth league',
  });

  it.each(['', 'park', 'RIVERSIDE', 'youth', 'park league'])('matches %j', (q) =>
    expect(matchesSearch(service, q)).toBe(true),
  );

  it.each(['gala', 'park gala'])('does not match %j', (q) =>
    expect(matchesSearch(service, q)).toBe(false),
  );
});

describe('arrangeEvents', () => {
  const later = event({ title: 'Later', startsAt: new Date(2026, 11, 1) });
  const soon = event({ title: 'Soon', category: 'service', startsAt: new Date(2026, 10, 1) });
  const cancelled = event({ title: 'Cancelled', startsAt: new Date(2026, 9, 30), cancelled: true });

  it('features the soonest event that is not cancelled, then lists the rest by date', () => {
    const { featured, rest } = arrangeEvents([later, soon, cancelled], {
      category: 'all',
      search: '',
    });
    expect(featured?.title).toBe('Soon');
    expect(rest.map((e) => e.title)).toEqual(['Cancelled', 'Later']);
  });

  it('filters by category', () => {
    const { featured, rest } = arrangeEvents([later, soon], { category: 'service', search: '' });
    expect(featured?.title).toBe('Soon');
    expect(rest).toEqual([]);
  });

  it('has no featured event when everything left is cancelled', () => {
    expect(arrangeEvents([cancelled], { category: 'all', search: '' })).toEqual({
      featured: null,
      rest: [cancelled],
    });
  });

  it('is empty when nothing matches', () => {
    expect(arrangeEvents([later, soon], { category: 'fundraiser', search: '' })).toEqual({
      featured: null,
      rest: [],
    });
  });
});

describe('emptyMessage', () => {
  it('fits the situation', () => {
    expect(emptyMessage('all', '')).toBe('Nothing on the calendar yet. Check back soon.');
    expect(emptyMessage('fundraiser', '')).toBe('No fundraiser events coming up.');
    expect(emptyMessage('service', 'gala')).toBe('No events match your search.');
  });
});

describe('detail formatting', () => {
  it.each([
    [0, 'Free'],
    [-5, 'Free'],
    [2500, '$25'],
    [1250, '$12.50'],
  ])('formatFee(%i) is %s', (cents, expected) => expect(formatFee(cents)).toBe(expected));

  it('formats time ranges compactly', () => {
    const at = (h: number, m = 0, d = 7) => new Date(2026, 10, d, h, m);
    expect(formatTimeRange(at(19), at(22))).toBe('7:00 to 10:00 PM');
    expect(formatTimeRange(at(11), at(14))).toBe('11:00 AM to 2:00 PM');
    expect(formatTimeRange(at(19), null)).toBe('7:00 PM');
    expect(formatTimeRange(at(19), at(18))).toBe('7:00 PM');
    expect(formatTimeRange(at(22), at(1, 0, 8))).toBe('10:00 PM to Tomorrow, 1:00 AM');
  });

  it('describes the RSVP deadline', () => {
    expect(deadlineText(new Date(2026, 10, 6, 19), NOW)).toBe('Fri, Nov 6, 7:00 PM');
    expect(deadlineText(new Date(2026, 9, 29, 11), NOW)).toBe('RSVPs are closed');
    expect(deadlineText(null, NOW)).toBe('No deadline');
  });

  it.each([
    [0, [], 'No one has said they’re going yet.'],
    [1, ['Marcus Reed'], 'Marcus Reed is going'],
    [2, ['Marcus Reed', 'Chris Baptiste'], 'Marcus Reed and Chris Baptiste are going'],
    [
      3,
      ['Marcus Reed', 'Chris Baptiste', 'Zed Allen'],
      'Marcus Reed, Chris Baptiste and 1 other are going',
    ],
    [12, ['Marcus Reed', 'Chris Baptiste'], 'Marcus Reed, Chris Baptiste and 10 others are going'],
    [4, [], '4 brothers are going'],
  ])('goingSummary(%i) reads naturally', (count, names, expected) =>
    expect(goingSummary(count, names)).toBe(expected),
  );
});
