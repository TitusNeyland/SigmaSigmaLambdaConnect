import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
const att = jest.requireMock<typeof import('@/data/__mocks__/attendance')>('@/data/attendance');

async function type(target: Parameters<typeof fireEvent.changeText>[0], text: string) {
  await act(async () => {
    fireEvent.changeText(target, text);
  });
}

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

function signIn(role: Parameters<typeof roles.resetRolesMock>[0]) {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  roles.resetRolesMock(role);
  auth.setMockUser(auth.sampleUser());
}

const EVENT = att.sampleAttendanceEvent();
const ROSTER = [
  att.sampleEntry({ uid: 'ace', displayName: 'Sample Ace', rsvp: 'going' }),
  att.sampleEntry({ uid: 'bee', displayName: 'Sample Bee', rsvp: 'going', checkedIn: true }),
  att.sampleEntry({ uid: 'cee', displayName: 'Sample Cee', rsvp: 'maybe' }),
  att.sampleEntry({ uid: 'dee', displayName: 'Sample Dee', rsvp: 'not_going' }),
  att.sampleEntry({ uid: 'eve', displayName: 'Sample Eve', rsvp: null }),
];

beforeEach(() => {
  signIn({ role: 'officer', title: 'Secretary' });
  att.resetAttendanceMock();
  att.setMockAttendanceEvents([EVENT]);
  att.setMockRoster({ event: EVENT, members: ROSTER });
});

async function openRoster() {
  const r = await renderRouter('src/app', { initialUrl: `/chapter/attendance/${EVENT.id}` });
  await waitFor(() => expect(screen.getByTestId('checkin-line')).toBeTruthy());
  return r;
}

const listed = () =>
  screen
    .queryAllByTestId(/^roster-(?!search|filter|empty)/)
    .map((r) => String(r.props.testID).replace('roster-', ''));

describe('picking an event', () => {
  it('lists recent events and opens the roster', async () => {
    const r = await renderRouter('src/app', { initialUrl: '/chapter/attendance' });
    await waitFor(() => expect(screen.getByTestId(`attendance-event-${EVENT.id}`)).toBeTruthy());
    await press(screen.getByTestId(`attendance-event-${EVENT.id}`));
    expect(r.getPathname()).toBe(`/chapter/attendance/${EVENT.id}`);
    expect(att.fetchRoster).toHaveBeenCalledWith(EVENT.id);
  });

  it('says when there are no events, and retries on error', async () => {
    att.setMockAttendanceEvents([]);
    att.failAttendanceEventsLoad();
    await renderRouter('src/app', { initialUrl: '/chapter/attendance' });
    await waitFor(() => expect(screen.getByTestId('attendance-events-retry')).toBeTruthy());
    await press(screen.getByTestId('attendance-events-retry'));
    await waitFor(() => expect(screen.getByTestId('attendance-events-empty')).toBeTruthy());
  });

  it('opens from the leadership quick action', async () => {
    const r = await renderRouter('src/app', { initialUrl: '/chapter/leadership' });
    await waitFor(() => expect(screen.getByTestId('action-attendance')).toBeTruthy());
    await press(screen.getByTestId('action-attendance'));
    expect(r.getPathname()).toBe('/chapter/attendance');
  });
});

describe('checking in', () => {
  it('shows checked-in count against RSVPs, and RSVP’d people first', async () => {
    await openRoster();
    expect(screen.getByText(/Sample chapter meeting/)).toBeTruthy();
    expect(screen.getByTestId('checkin-line')).toHaveTextContent('1 checked in · 2 RSVP’d going');
    expect(screen.getByTestId('checkin-bar').props.accessibilityLabel).toBe(
      '1 checked in of 2 going',
    );
    expect(listed()).toEqual(['ace', 'bee', 'cee']);
    expect(screen.getByTestId('roster-bee').props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('tap checks in and out, and the count follows', async () => {
    await openRoster();
    await press(screen.getByTestId('roster-ace'));
    expect(screen.getByTestId('roster-ace').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('checkin-line')).toHaveTextContent(/^2 checked in/);
    await press(screen.getByTestId('roster-ace'));
    expect(screen.getByTestId('checkin-line')).toHaveTextContent(/^1 checked in/);
  });

  it('searches by name and switches to everyone', async () => {
    await openRoster();
    await type(screen.getByTestId('roster-search'), 'eve');
    expect(listed()).toEqual([]);
    expect(screen.getByTestId('roster-empty')).toHaveTextContent('No one matches that.');
    await press(screen.getByRole('tab', { name: 'Everyone' }));
    expect(listed()).toEqual(['eve']);
    await type(screen.getByTestId('roster-search'), '');
    expect(listed()).toEqual(['ace', 'bee', 'cee', 'dee', 'eve']);
  });

  it('adds a walk-in from everyone, and they stay listed under RSVP’d', async () => {
    await openRoster();
    await press(screen.getByTestId('add-walk-in'));
    await press(screen.getByTestId('roster-eve'));
    expect(screen.getByTestId('roster-eve').props.accessibilityLabel).toBe(
      'Sample Eve, No RSVP · Walk-in',
    );
    await press(screen.getByRole('tab', { name: 'RSVP’d' }));
    expect(listed()).toContain('eve');
  });

  it('nudges to Everyone when nobody RSVP’d', async () => {
    att.setMockRoster({ event: EVENT, members: [att.sampleEntry({ uid: 'z', rsvp: null })] });
    await openRoster();
    expect(screen.getByTestId('roster-empty')).toHaveTextContent(/Switch to Everyone/);
  });
});

describe('saving', () => {
  it('saves new check-ins and removals, marking walk-ins', async () => {
    await openRoster();
    expect(screen.getByTestId('attendance-save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await press(screen.getByTestId('roster-ace'));
    await press(screen.getByTestId('roster-bee'));
    await press(screen.getByTestId('add-walk-in'));
    await press(screen.getByTestId('roster-eve'));
    await press(screen.getByTestId('attendance-save'));
    expect(att.saveAttendance).toHaveBeenCalledWith(EVENT.id, auth.sampleUser().uid, {
      checkIn: [
        { uid: 'ace', walkIn: false },
        { uid: 'eve', walkIn: true },
      ],
      remove: ['bee'],
      serviceHours: null,
    });
    expect(screen.getByTestId('attendance-saved')).toHaveTextContent('Saved. 2 checked in.');
    // Nothing left to send until something changes.
    expect(screen.getByTestId('attendance-save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('logs the same service hours for everyone checked in', async () => {
    await openRoster();
    await press(screen.getByTestId('roster-ace'));
    await act(async () => {
      fireEvent(screen.getByTestId('log-hours'), 'valueChange', true);
    });
    await type(screen.getByTestId('hours-each'), '30');
    expect(screen.getByText('Enter hours from 0.5 to 24.')).toBeTruthy();
    expect(screen.getByTestId('attendance-save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await type(screen.getByTestId('hours-each'), '2');
    await press(screen.getByTestId('attendance-save'));
    expect(att.saveAttendance).toHaveBeenCalledWith(EVENT.id, auth.sampleUser().uid, {
      checkIn: [
        { uid: 'ace', walkIn: false },
        { uid: 'bee', walkIn: false },
      ],
      remove: [],
      serviceHours: 2,
    });
    expect(screen.getByTestId('attendance-saved')).toHaveTextContent(
      'Saved. 2 checked in, 4 service hours logged.',
    );
  });

  it('starts with the hours already saved for the event', async () => {
    att.setMockRoster({
      event: EVENT,
      members: [att.sampleEntry({ uid: 'bee', checkedIn: true, serviceHours: 3 })],
    });
    await openRoster();
    expect(screen.getByTestId('log-hours').props.value).toBe(true);
    expect(screen.getByTestId('hours-each').props.value).toBe('3');
  });

  it('says so when saving fails', async () => {
    await openRoster();
    await press(screen.getByTestId('roster-ace'));
    att.failNextAttendanceSave();
    await press(screen.getByTestId('attendance-save'));
    expect(screen.getByTestId('attendance-failed')).toBeTruthy();
    await press(screen.getByTestId('attendance-save'));
    expect(screen.getByTestId('attendance-saved')).toBeTruthy();
  });
});

describe('access and errors', () => {
  it('is officers only, and loads nothing for members', async () => {
    signIn(null);
    await renderRouter('src/app', { initialUrl: `/chapter/attendance/${EVENT.id}` });
    await waitFor(() => expect(screen.getByTestId('attendance-denied')).toBeTruthy());
    expect(att.fetchRoster).not.toHaveBeenCalled();
  });

  it('handles a missing event and a failed load', async () => {
    att.setMockRoster(null);
    await renderRouter('src/app', { initialUrl: '/chapter/attendance/gone' });
    await waitFor(() => expect(screen.getByTestId('attendance-missing')).toBeTruthy());
  });

  it('retries a failed roster load', async () => {
    att.failRosterLoad();
    await renderRouter('src/app', { initialUrl: `/chapter/attendance/${EVENT.id}` });
    await waitFor(() => expect(screen.getByTestId('attendance-retry')).toBeTruthy());
    await press(screen.getByTestId('attendance-retry'));
    await waitFor(() => expect(screen.getByTestId('checkin-line')).toBeTruthy());
  });
});
