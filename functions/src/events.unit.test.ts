import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import { deadlineNudgeMessage, formatWhen, newEventMessage, reminderMessage } from './events';

// 7:00 PM Central on Sat, Nov 7 2026 (CST, UTC-6).
const SEVEN_PM = new Date('2026-11-08T01:00:00Z');
const event = {
  title: ' Scholarship gala ',
  location: 'Hotel ballroom',
  startsAt: Timestamp.fromDate(SEVEN_PM),
  rsvpDeadline: Timestamp.fromDate(new Date('2026-11-06T23:00:00Z')),
};

describe('formatWhen', () => {
  it('uses the chapter’s time zone, not UTC', () => {
    expect(formatWhen(SEVEN_PM)).toBe('Sat, Nov 7 at 7:00 PM');
    expect(formatWhen(SEVEN_PM, 'America/New_York')).toBe('Sat, Nov 7 at 8:00 PM');
  });
});

describe('messages', () => {
  it('announces a new event with when and where, linking to it', () => {
    expect(newEventMessage('gala', event)).toEqual({
      title: 'New event: Scholarship gala',
      body: 'Sat, Nov 7 at 7:00 PM · Hotel ballroom',
      data: { eventId: 'gala' },
    });
  });

  it('does not announce a cancelled or incomplete event', () => {
    expect(newEventMessage('gala', { ...event, cancelled: true })).toBeNull();
    expect(newEventMessage('gala', { ...event, title: '' })).toBeNull();
    expect(newEventMessage('gala', { ...event, startsAt: 'soon' })).toBeNull();
  });

  it('reminds with when and where, leaving out a missing place', () => {
    expect(reminderMessage('gala', { ...event, location: '' })).toEqual({
      title: 'Coming up: Scholarship gala',
      body: 'Sat, Nov 7 at 7:00 PM',
      data: { eventId: 'gala' },
    });
  });

  it('nudges with the deadline', () => {
    expect(deadlineNudgeMessage('gala', event)).toEqual({
      title: 'RSVP for Scholarship gala',
      body: 'Let the chapter know if you’re coming by Fri, Nov 6 at 5:00 PM.',
      data: { eventId: 'gala' },
    });
    expect(deadlineNudgeMessage('gala', { ...event, rsvpDeadline: null })).toBeNull();
  });
});
