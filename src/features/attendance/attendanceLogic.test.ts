import { sampleEntry } from '@/data/__mocks__/attendance';

import {
  attendanceChanges,
  checkInSummary,
  parseHours,
  savedHours,
  savedMessage,
  visibleRoster,
} from './attendanceLogic';

const going = sampleEntry({ uid: 'g', displayName: 'Sample Going', rsvp: 'going' });
const maybe = sampleEntry({ uid: 'm', displayName: 'Sample Maybe', rsvp: 'maybe' });
const no = sampleEntry({ uid: 'n', displayName: 'Sample Cant', rsvp: 'not_going' });
const none = sampleEntry({ uid: 'x', displayName: 'Sample Nobody', rsvp: null });
const ALL = [going, maybe, no, none];

describe('visibleRoster', () => {
  it('RSVP’d shows going and maybe, plus anyone checked in', () => {
    expect(visibleRoster(ALL, new Set(), 'rsvpd', '').map((m) => m.uid)).toEqual(['g', 'm']);
    expect(visibleRoster(ALL, new Set(['x']), 'rsvpd', '').map((m) => m.uid)).toEqual([
      'g',
      'm',
      'x',
    ]);
  });

  it('Everyone shows all, and search narrows by name', () => {
    expect(visibleRoster(ALL, new Set(), 'all', '')).toHaveLength(4);
    expect(visibleRoster(ALL, new Set(), 'all', '  noBODY ').map((m) => m.uid)).toEqual(['x']);
    expect(visibleRoster(ALL, new Set(), 'rsvpd', 'nobody')).toEqual([]);
  });
});

describe('checkInSummary', () => {
  it('counts check-ins against going RSVPs', () => {
    expect(checkInSummary(ALL, new Set(['g', 'x']))).toEqual({
      checkedIn: 2,
      going: 1,
      percent: 100,
      line: '2 checked in · 1 RSVP’d going',
    });
    expect(checkInSummary(ALL, new Set()).percent).toBe(0);
    expect(checkInSummary([none], new Set(['x'])).percent).toBe(0);
  });
});

describe('parseHours', () => {
  it.each([
    ['2', 2],
    ['1.5', 1.5],
    ['1.3', 1.5],
    ['24', 24],
    [' 3 ', 3],
  ])('"%s" is %d', (text, n) => expect(parseHours(text)).toBe(n));

  it.each(['', '0', '25', '-1', 'two', '1.5.2'])('"%s" is not valid', (text) =>
    expect(parseHours(text)).toBeNull(),
  );
});

describe('savedHours', () => {
  it('is the hours on an existing check-in, if any', () => {
    expect(savedHours([going, { ...maybe, checkedIn: true, serviceHours: 3 }])).toBe(3);
    expect(savedHours([{ ...going, checkedIn: true }])).toBeNull();
  });
});

describe('attendanceChanges', () => {
  const saved = { ...going, checkedIn: true, serviceHours: 2 };

  it('checks in new people, marking walk-ins, and undoes removed ones', () => {
    expect(attendanceChanges([saved, maybe, none], new Set(['m', 'x']), null)).toEqual({
      checkIn: [
        { uid: 'm', walkIn: false },
        { uid: 'x', walkIn: true },
      ],
      remove: ['g'],
      serviceHours: null,
    });
  });

  it('re-saves existing check-ins only when their hours change', () => {
    expect(attendanceChanges([saved], new Set(['g']), 2).checkIn).toEqual([]);
    expect(attendanceChanges([saved], new Set(['g']), 3).checkIn).toEqual([
      { uid: 'g', walkIn: false },
    ]);
    // Turning hours off leaves saved hours alone.
    expect(attendanceChanges([saved], new Set(['g']), null).checkIn).toEqual([]);
  });
});

describe('savedMessage', () => {
  it.each([
    [14, 2, 'Saved. 14 checked in, 28 service hours logged.'],
    [1, 1, 'Saved. 1 checked in, 1 service hour logged.'],
    [3, 1.5, 'Saved. 3 checked in, 4.5 service hours logged.'],
    [5, null, 'Saved. 5 checked in.'],
    [0, 2, 'Saved. 0 checked in.'],
  ])('%i people at %s hours', (n, h, text) => expect(savedMessage(n, h)).toBe(text));
});
