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
const events = jest.requireMock<typeof import('@/data/__mocks__/events')>('@/data/events');

const day = (n: number, hour = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const EVENTS = [
  events.sampleEvent({
    id: 'meeting',
    title: 'Sample chapter meeting',
    category: 'meeting',
    startsAt: day(3),
    location: 'Chapter house',
    myRsvp: 'going',
  }),
  events.sampleEvent({
    id: 'service',
    title: 'Sample park cleanup',
    category: 'service',
    startsAt: day(5, 9),
    location: 'Riverside Park',
    description: 'Sample service day with the youth league',
    myRsvp: 'maybe',
  }),
  events.sampleEvent({
    id: 'gala',
    title: 'Sample scholarship gala',
    category: 'fundraiser',
    startsAt: day(9),
    location: 'Hotel ballroom',
  }),
  events.sampleEvent({
    id: 'social',
    title: 'Sample cookout',
    category: 'social',
    startsAt: day(1),
    cancelled: true,
  }),
];

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function type(text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('Search events'), text);
  });
}

const rows = () =>
  screen.queryAllByTestId(/^event-/).map((r) => String(r.props.testID).replace('event-', ''));

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
  roles.resetRolesMock(null);
  events.resetEventsMock(EVENTS);
  auth.setMockUser(auth.sampleUser());
});

async function openEvents() {
  await renderRouter('src/app', { initialUrl: '/events' });
  await waitFor(() => expect(screen.getByTestId('featured-event')).toBeTruthy());
}

it('loads events for the signed-in member', async () => {
  await openEvents();
  expect(events.fetchUpcomingEvents).toHaveBeenCalledWith(auth.sampleUser().uid, expect.any(Date));
  expect(screen.getByRole('header', { name: 'Events' })).toBeTruthy();
});

it('features the next event that isn’t cancelled, then lists the rest in date order', async () => {
  await openEvents();
  const featured = screen.getByTestId('featured-event');
  expect(featured.props.accessibilityLabel).toMatch(/^Next up, Sample chapter meeting, /);
  expect(featured.props.accessibilityLabel).toMatch(/7:00 PM · Chapter house, Going$/);
  expect(rows()).toEqual(['social', 'service', 'gala']);
});

it('shows my RSVP state on each row, and marks cancelled events', async () => {
  await openEvents();
  expect(screen.getByTestId('status-meeting')).toHaveTextContent('Going');
  expect(screen.getByTestId('status-service')).toHaveTextContent('Maybe');
  expect(screen.queryByTestId('status-gala')).toBeNull();
  expect(screen.getByTestId('status-social')).toHaveTextContent('Cancelled');
  expect(screen.getByText('9:00 AM · Riverside Park')).toBeTruthy();
});

it('filters by category chip', async () => {
  await openEvents();
  await press(screen.getByRole('button', { name: 'Fundraisers' }));
  expect(screen.getByTestId('featured-event').props.accessibilityLabel).toMatch(/gala/);
  expect(rows()).toEqual([]);
  await press(screen.getByRole('button', { name: 'All' }));
  expect(rows()).toEqual(['social', 'service', 'gala']);
});

it('searches title, place and description', async () => {
  await openEvents();
  await type('youth');
  expect(screen.getByTestId('featured-event').props.accessibilityLabel).toMatch(/park cleanup/);
  expect(rows()).toEqual([]);
  await type('ballroom');
  expect(screen.getByTestId('featured-event').props.accessibilityLabel).toMatch(/gala/);
});

it('shows an empty state when a category has no events', async () => {
  await openEvents();
  await press(screen.getByRole('button', { name: 'Learning' }));
  expect(screen.getByTestId('events-empty')).toBeTruthy();
  expect(screen.getByText('No learning events coming up.')).toBeTruthy();
  expect(screen.queryByTestId('featured-event')).toBeNull();
});

it('shows an empty state when nothing is scheduled', async () => {
  events.resetEventsMock([]);
  await renderRouter('src/app', { initialUrl: '/events' });
  await waitFor(() =>
    expect(screen.getByText('Nothing on the calendar yet. Check back soon.')).toBeTruthy(),
  );
});

it('opens an event from the featured card and from a row', async () => {
  await openEvents();
  await press(screen.getByTestId('featured-event'));
  await waitFor(() => expect(screen).toHavePathname('/events/meeting'));
  await press(screen.getByTestId('event-back'));
  await waitFor(() => expect(screen.getByTestId('event-gala')).toBeTruthy());
  await press(screen.getByTestId('event-gala'));
  await waitFor(() => expect(screen).toHavePathname('/events/gala'));
});

it('offers a retry when events can’t load', async () => {
  events.failEventsLoad();
  await renderRouter('src/app', { initialUrl: '/events' });
  await waitFor(() => expect(screen.getByText('Couldn’t load events.')).toBeTruthy());
  await press(screen.getByTestId('events-retry'));
  await waitFor(() => expect(screen.getByTestId('featured-event')).toBeTruthy());
});

it('reloads when you come back to the tab, so a changed RSVP shows', async () => {
  await openEvents();
  await press(screen.getByTestId('event-gala'));
  await waitFor(() => expect(screen).toHavePathname('/events/gala'));
  events.setMockEvents(
    EVENTS.map((e) => (e.id === 'gala' ? { ...e, myRsvp: 'not_going' as const } : e)),
  );
  await press(screen.getByTestId('event-back'));
  await waitFor(() => expect(screen.getByTestId('status-gala')).toHaveTextContent('Can’t go'));
});

describe('Upcoming and Calendar', () => {
  it('switches between the list and the calendar', async () => {
    await openEvents();
    expect(screen.getByRole('tab', { name: 'Upcoming' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await press(screen.getByRole('tab', { name: 'Calendar' }));
    await waitFor(() => expect(screen.getByTestId('calendar')).toBeTruthy());
    expect(screen.queryByTestId('featured-event')).toBeNull();
    expect(events.fetchEventsBetween).toHaveBeenCalledWith(
      auth.sampleUser().uid,
      expect.any(Date),
      expect.any(Date),
    );
    await press(screen.getByRole('tab', { name: 'Upcoming' }));
    expect(screen.getByTestId('featured-event')).toBeTruthy();
  });

  it('opens straight to the calendar from a link (the Chapter tile)', async () => {
    await renderRouter('src/app', { initialUrl: '/events?view=calendar' });
    await waitFor(() => expect(screen.getByTestId('calendar')).toBeTruthy());
    expect(screen.getByRole('tab', { name: 'Calendar' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await press(screen.getByRole('tab', { name: 'Upcoming' }));
    await waitFor(() => expect(screen.getByTestId('featured-event')).toBeTruthy());
  });
});
