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
const events = jest.requireMock<typeof import('@/data/__mocks__/events')>('@/data/events');

const inDays = (n: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const GALA = events.sampleDetail({
  id: 'gala',
  title: 'Sample scholarship gala',
  category: 'fundraiser',
  description: 'Sample dinner raising money for the chapter scholarship.',
  startsAt: inDays(9, 19),
  endsAt: inDays(9, 22),
  location: 'Hotel ballroom',
  address: '200 Sample Ave',
  photoURL: 'https://example.test/gala.jpg',
  feeCents: 2500,
  rsvpDeadline: inDays(7, 17),
  host: { uid: 'sample-jordan', displayName: 'Jordan Hill', photoURL: null },
  going: {
    count: 12,
    preview: [
      { uid: 'a', displayName: 'Marcus Reed', photoURL: null },
      { uid: 'b', displayName: 'Chris Baptiste', photoURL: null },
      { uid: 'c', displayName: 'Zed Allen', photoURL: null },
    ],
  },
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
  roles.resetRolesMock(null);
  events.resetEventsMock([]);
  events.setMockDetails({ gala: GALA });
  auth.setMockUser(auth.sampleUser());
});

async function openEvent(id = 'gala') {
  await renderRouter('src/app', { initialUrl: `/events/${id}` });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
}

it('loads the event for the signed-in member', async () => {
  await openEvent();
  expect(events.fetchEventDetail).toHaveBeenCalledWith('gala', auth.sampleUser().uid);
});

it('shows the hero photo, category, title and host', async () => {
  await openEvent();
  expect(JSON.stringify(screen.getByTestId('event-hero').props.source)).toContain(
    'https://example.test/gala.jpg',
  );
  expect(screen.getByText('FUNDRAISER')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Sample scholarship gala' })).toBeTruthy();
  expect(screen.getByText('Hosted by Jordan Hill')).toBeTruthy();
});

it('uses the monogram when there is no photo, and leaves out a missing host', async () => {
  events.setMockDetails({ gala: { ...GALA, photoURL: null, host: null } });
  await openEvent();
  expect(screen.getByTestId('event-hero-blank')).toBeTruthy();
  expect(screen.queryByTestId('event-host')).toBeNull();
});

it('shows date, place, fee and RSVP deadline rows', async () => {
  await openEvent();
  expect(screen.getByTestId('event-date').props.accessibilityLabel).toMatch(
    /^Date, \w{3}, \w{3} \d{1,2}, 7:00 to 10:00 PM$/,
  );
  expect(screen.getByTestId('event-place').props.accessibilityLabel).toBe(
    'Place, Hotel ballroom, 200 Sample Ave',
  );
  expect(screen.getByTestId('event-fee').props.accessibilityLabel).toBe('Fee, $25');
  expect(screen.getByTestId('event-deadline').props.accessibilityLabel).toMatch(
    /^RSVP by, \w{3}, \w{3} \d{1,2}, 5:00 PM$/,
  );
});

it('says when RSVPs have closed and when an event is free', async () => {
  events.setMockDetails({ gala: { ...GALA, feeCents: 0, rsvpDeadline: inDays(-1, 9) } });
  await openEvent();
  expect(screen.getByTestId('event-fee').props.accessibilityLabel).toBe('Fee, Free');
  expect(screen.getByTestId('event-deadline').props.accessibilityLabel).toBe(
    'RSVP by, RSVPs are closed',
  );
});

it('summarizes who’s going and shows the about text', async () => {
  await openEvent();
  expect(screen.getByText('Marcus Reed, Chris Baptiste and 10 others are going')).toBeTruthy();
  expect(
    screen.getAllByRole('image', { name: /Marcus Reed|Chris Baptiste|Zed Allen/ }),
  ).toHaveLength(3);
  expect(screen.getByTestId('event-about')).toHaveTextContent(
    'Sample dinner raising money for the chapter scholarship.',
  );
});

it('handles nobody going and no description', async () => {
  events.setMockDetails({
    gala: { ...GALA, description: '', going: { count: 0, preview: [] } },
  });
  await openEvent();
  expect(screen.getByText('No one has said they’re going yet.')).toBeTruthy();
  expect(screen.queryByTestId('event-about')).toBeNull();
});

it('flags a cancelled event', async () => {
  events.setMockDetails({ gala: { ...GALA, cancelled: true } });
  await openEvent();
  expect(screen.getByText('This event was cancelled.')).toBeTruthy();
});

it('says so when the event is gone', async () => {
  await openEvent('deleted');
  expect(screen.getByText('This event isn’t available. It may have been deleted.')).toBeTruthy();
});

it('offers a retry when it can’t load', async () => {
  events.failEventsLoad();
  await openEvent();
  expect(screen.getByText('Couldn’t load this event.')).toBeTruthy();
  await press(screen.getByTestId('event-retry'));
  await waitFor(() => expect(screen.getByText('Hosted by Jordan Hill')).toBeTruthy());
});

it('goes back to the Events list', async () => {
  await openEvent();
  await press(screen.getByTestId('event-back'));
  await waitFor(() => expect(screen).toHavePathname('/events'));
});
