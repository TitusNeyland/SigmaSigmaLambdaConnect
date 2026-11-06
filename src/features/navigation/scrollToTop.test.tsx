import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
const events = jest.requireMock<typeof import('@/data/__mocks__/events')>('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
const feed = jest.requireMock<typeof import('@/data/__mocks__/feed')>('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');

// Every scroll view and list in tests scrolls through this (React Native's ScrollView mock).
const scrollTo = jest.spyOn(
  ScrollView.prototype as unknown as { scrollTo: () => void },
  'scrollTo',
);
const toTop = expect.objectContaining({ y: 0, animated: true });

beforeEach(() => {
  scrollTo.mockClear();
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  feed.resetFeedMock([feed.samplePost({ id: 'p1' }), feed.samplePost({ id: 'p2' })]);
  events.resetEventsMock([events.sampleEvent({ id: 'e1' })]);
  auth.setMockUser(auth.sampleUser());
});

async function tap(tab: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`tab-${tab}`));
  });
}

async function open(tab: string, ready: string) {
  await renderRouter('src/app', { initialUrl: `/${tab}` });
  await waitFor(() => expect(screen.getByTestId(ready)).toBeTruthy());
}

it('tapping Home while on the feed scrolls it back to the top', async () => {
  await open('home', 'post-p1');
  await tap('home');
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(toTop));
});

it('tapping Events while on Events scrolls back to the top', async () => {
  await open('events', 'tab-events');
  await tap('events');
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(toTop));
});

it('tapping Chapter and Profile while on them scrolls back to the top', async () => {
  await open('chapter', 'tab-chapter');
  await tap('chapter');
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(toTop));
  scrollTo.mockClear();
  await tap('profile');
  await waitFor(() => expect(screen.getByTestId('profile-scroll')).toBeTruthy());
  expect(scrollTo).not.toHaveBeenCalled();
  await tap('profile');
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(toTop));
});

it('switching to another tab just opens it, without scrolling', async () => {
  await open('home', 'post-p1');
  await tap('events');
  await waitFor(() => expect(screen).toHavePathname('/events'));
  // Only the second tap, once on Events, scrolls.
  await tap('events');
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(toTop));
  expect(scrollTo).toHaveBeenCalledTimes(1);
});
