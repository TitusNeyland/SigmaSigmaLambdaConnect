import { describe, expect, it } from 'vitest';

import { DEFAULT_NOTIFICATION_PREFS } from '../../src/data/types';

import { approvalMessage, chunk, DEFAULT_PREFS, wantsPush } from './push';

describe('wantsPush', () => {
  const approved = (prefs?: unknown) => ({ status: 'approved', notificationPrefs: prefs });

  it('uses the same defaults as the app’s Settings screen', () => {
    expect(DEFAULT_PREFS).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('follows the member’s switches', () => {
    expect(wantsPush(approved({ events: false }), 'events')).toBe(false);
    expect(wantsPush(approved({ tasks: true }), 'tasks')).toBe(true);
  });

  it('falls back to the defaults for missing or malformed switches', () => {
    expect(wantsPush(approved(), 'events')).toBe(true);
    expect(wantsPush(approved(), 'tasks')).toBe(false);
    expect(wantsPush(approved({ social: 'no' }), 'social')).toBe(true);
    expect(wantsPush(approved('junk'), 'announcements')).toBe(true);
  });

  it('only sends chapter notifications to approved members', () => {
    for (const status of ['pending', 'declined', undefined]) {
      expect(wantsPush({ status }, 'events')).toBe(false);
    }
    expect(wantsPush(undefined, 'events')).toBe(false);
  });

  it('always sends account notifications, whatever the switches say', () => {
    expect(wantsPush({ status: 'pending' }, 'account')).toBe(true);
    expect(
      wantsPush(
        approved({ events: false, announcements: false, social: false, tasks: false }),
        'account',
      ),
    ).toBe(true);
    expect(wantsPush(undefined, 'account')).toBe(false);
  });
});

describe('officer notices', () => {
  it('always go to approved members, whatever the switches say', () => {
    expect(
      wantsPush(
        { status: 'approved', notificationPrefs: { tasks: false, events: false } },
        'officer',
      ),
    ).toBe(true);
    expect(wantsPush({ status: 'pending' }, 'officer')).toBe(false);
  });
});

describe('approvalMessage', () => {
  it('only fires when a pending member is approved', () => {
    expect(approvalMessage({ status: 'pending' }, { status: 'approved' })).toMatchObject({
      title: 'You’re in',
    });
    expect(approvalMessage({ status: 'pending' }, { status: 'declined' })).toBeNull();
    expect(approvalMessage({ status: 'approved' }, { status: 'approved' })).toBeNull();
    expect(approvalMessage(undefined, { status: 'approved' })).toBeNull();
  });
});

describe('chunk', () => {
  it('splits into Expo-sized batches', () => {
    const items = Array.from({ length: 205 }, (_, i) => i);
    expect(chunk(items).map((c) => c.length)).toEqual([100, 100, 5]);
    expect(chunk([])).toEqual([]);
  });
});
