import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { Linking } from 'react-native';

import type { EventDetail } from '@/data/events';

import {
  addToCalendar,
  calendarEntry,
  destination,
  directionsUrl,
  openDirections,
} from './eventActions';

const GALA: EventDetail = {
  id: 'gala',
  title: 'Sample scholarship gala',
  category: 'fundraiser',
  description: '  Sample dinner.  ',
  startsAt: new Date(2026, 10, 7, 19),
  endsAt: new Date(2026, 10, 7, 22),
  location: 'Hotel ballroom',
  photoURL: null,
  cancelled: false,
  myRsvp: null,
  address: '200 Sample Ave, Nashville, TN',
  feeCents: 0,
  rsvpDeadline: null,
  host: null,
  going: { count: 0, preview: [] },
};

const create = jest.mocked(createEventInCalendarAsync);

describe('calendarEntry', () => {
  it('copies the event into a calendar entry', () => {
    expect(calendarEntry(GALA)).toEqual({
      title: 'Sample scholarship gala',
      startDate: new Date(2026, 10, 7, 19),
      endDate: new Date(2026, 10, 7, 22),
      location: 'Hotel ballroom, 200 Sample Ave, Nashville, TN',
      notes: 'Sample dinner.',
    });
  });

  it('makes an event without an end three hours long', () => {
    expect(calendarEntry({ ...GALA, endsAt: null, address: '' })).toMatchObject({
      endDate: new Date(2026, 10, 7, 22),
      location: 'Hotel ballroom',
    });
  });
});

describe('addToCalendar', () => {
  it.each([
    ['saved', 'added'],
    ['done', 'added'],
    ['canceled', 'canceled'],
    ['deleted', 'canceled'],
  ] as const)('treats %s as %s', async (action, expected) => {
    create.mockResolvedValueOnce({ action, id: null } as never);
    expect(await addToCalendar(GALA)).toBe(expected);
    expect(create).toHaveBeenLastCalledWith(calendarEntry(GALA));
  });

  it('reports a failure instead of throwing', async () => {
    create.mockRejectedValueOnce(new Error('no calendar app'));
    expect(await addToCalendar(GALA)).toBe('failed');
  });
});

describe('directions', () => {
  it('goes to the address, or the place name when there is none', () => {
    expect(destination(GALA)).toBe('200 Sample Ave, Nashville, TN');
    expect(destination({ location: ' Chapter house ', address: '' })).toBe('Chapter house');
  });

  it('uses Apple Maps on iOS and Google Maps elsewhere', () => {
    expect(directionsUrl('200 Sample Ave, Nashville', 'ios')).toBe(
      'https://maps.apple.com/?daddr=200%20Sample%20Ave%2C%20Nashville',
    );
    expect(directionsUrl('200 Sample Ave & 5th', 'android')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=200%20Sample%20Ave%20%26%205th',
    );
  });

  it('opens maps, and says when it could not', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);
    expect(await openDirections(GALA)).toBe(true);
    expect(open).toHaveBeenCalledWith(expect.stringContaining('200%20Sample%20Ave'));
    open.mockRejectedValueOnce(new Error('no maps'));
    expect(await openDirections(GALA)).toBe(false);
    expect(await openDirections({ ...GALA, location: '', address: '' })).toBe(false);
    open.mockRestore();
  });
});
