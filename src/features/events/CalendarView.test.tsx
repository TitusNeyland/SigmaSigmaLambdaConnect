import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { CalendarView } from './CalendarView';

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
const events = jest.requireMock<typeof import('@/data/__mocks__/events')>('@/data/events');

const TODAY = new Date(2026, 9, 29, 12); // Thu, Oct 29 2026

const EVENTS = [
  events.sampleEvent({
    id: 'meeting',
    title: 'Sample chapter meeting',
    startsAt: new Date(2026, 9, 29, 19),
    location: 'Chapter house',
    myRsvp: 'going',
  }),
  events.sampleEvent({
    id: 'past',
    title: 'Sample past mixer',
    category: 'social',
    startsAt: new Date(2026, 9, 3, 18),
  }),
  events.sampleEvent({
    id: 'service',
    title: 'Sample park cleanup',
    category: 'service',
    startsAt: new Date(2026, 10, 7, 9),
  }),
  events.sampleEvent({
    id: 'gala',
    title: 'Sample scholarship gala',
    category: 'fundraiser',
    startsAt: new Date(2026, 10, 7, 19),
  }),
];

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function renderCalendar(props: { category?: 'all' | 'service'; search?: string } = {}) {
  await renderRouter(
    {
      index: () => (
        <CalendarView
          uid="me"
          category={props.category ?? 'all'}
          search={props.search ?? ''}
          today={TODAY}
        />
      ),
    },
    { initialUrl: '/' },
  );
  await waitFor(() => expect(screen.getByTestId('month-title')).toHaveTextContent('October 2026'));
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
}

const rows = () =>
  screen.queryAllByTestId(/^event-/).map((r) => String(r.props.testID).replace('event-', ''));

beforeEach(() => events.resetEventsMock(EVENTS));

it('opens on this month with today selected, and loads only this month', async () => {
  await renderCalendar();
  expect(events.fetchEventsBetween).toHaveBeenCalledWith(
    'me',
    new Date(2026, 9, 1),
    new Date(2026, 10, 1),
  );
  expect(screen.getByTestId('day-2026-10-29').props.accessibilityState).toMatchObject({
    selected: true,
  });
  expect(screen.getByRole('header', { name: 'THURSDAY, OCTOBER 29' })).toBeTruthy();
  expect(rows()).toEqual(['meeting']);
});

it('puts gold dots on days with events, including past ones', async () => {
  await renderCalendar();
  expect(screen.getByTestId('dot-2026-10-29')).toBeTruthy();
  expect(screen.getByTestId('dot-2026-10-03')).toBeTruthy();
  expect(screen.queryByTestId('dot-2026-10-04')).toBeNull();
  expect(screen.getByRole('button', { name: 'Saturday, October 3, 1 event' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sunday, October 4' })).toBeTruthy();
});

it('lists a day’s events when you tap it, and says when a day is empty', async () => {
  await renderCalendar();
  await press(screen.getByTestId('day-2026-10-03'));
  expect(rows()).toEqual(['past']);
  await press(screen.getByTestId('day-2026-10-04'));
  expect(screen.getByTestId('day-empty')).toBeTruthy();
  expect(screen.getByText('No events this day.')).toBeTruthy();
});

it('moves to the next and previous month', async () => {
  await renderCalendar();
  await press(screen.getByRole('button', { name: 'Next month' }));
  await waitFor(() => expect(screen.getByTestId('month-title')).toHaveTextContent('November 2026'));
  expect(events.fetchEventsBetween).toHaveBeenLastCalledWith(
    'me',
    new Date(2026, 10, 1),
    new Date(2026, 11, 1),
  );
  // Not this month, so it opens on the first day with an event.
  await waitFor(() => expect(rows()).toEqual(['service', 'gala']));
  expect(screen.getByRole('button', { name: 'Saturday, November 7, 2 events' })).toBeTruthy();

  await press(screen.getByRole('button', { name: 'Previous month' }));
  await press(screen.getByRole('button', { name: 'Previous month' }));
  await waitFor(() =>
    expect(screen.getByTestId('month-title')).toHaveTextContent('September 2026'),
  );
  await waitFor(() => expect(screen.getByText('No events this day.')).toBeTruthy());
});

it('applies the category filter and search', async () => {
  await renderRouter(
    {
      index: () => <CalendarView uid="me" category="service" search="" today={TODAY} />,
    },
    { initialUrl: '/' },
  );
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  expect(screen.queryByTestId('dot-2026-10-29')).toBeNull();
  await press(screen.getByRole('button', { name: 'Next month' }));
  await waitFor(() => expect(rows()).toEqual(['service']));
});

it('offers a retry when a month can’t load', async () => {
  events.failEventsLoad();
  await renderRouter(
    { index: () => <CalendarView uid="me" category="all" search="" today={TODAY} /> },
    { initialUrl: '/' },
  );
  await waitFor(() => expect(screen.getByText('Couldn’t load this month.')).toBeTruthy());
  await press(screen.getByTestId('calendar-retry'));
  await waitFor(() => expect(rows()).toEqual(['meeting']));
});
