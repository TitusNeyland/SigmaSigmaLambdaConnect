import {
  act,
  fireEvent,
  renderRouter,
  screen,
  testRouter,
  waitFor,
} from 'expo-router/testing-library';
import { Text } from 'react-native';

import { TABS } from './TabLayout';

jest.mock('@/data/auth');
const { resetAuthMock, sampleUser, setMockUser } =
  jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
jest.mock('@/data/roles');
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
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');

beforeEach(() => {
  resetAuthMock();
  members.resetMembersMock();
  setMockUser(sampleUser());
});

// The real app routes, plus one extra screen inside the Home tab to prove each tab keeps
// its own stack.
const APP = {
  appDir: 'src/app',
  overrides: {
    '(tabs)/home/detail': () => <Text>Home detail</Text>,
  },
};

describe('tab bar', () => {
  it('shows the five tabs in order with their labels', async () => {
    await renderRouter(APP, { initialUrl: '/home' });
    expect(TABS.map((t) => t.title)).toEqual(['Home', 'Events', 'Post', 'Chapter', 'Profile']);
    for (const tab of TABS) {
      expect(screen.getByTestId(`tab-${tab.name}`)).toBeTruthy();
    }
    expect(screen.getByLabelText('Create a post')).toBeTruthy();
  });

  it('opens on Home with the Home tab active', async () => {
    await renderRouter(APP, { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/home'));
    expect(screen.getByText('Sigma Sigma Lambda')).toBeTruthy();
    expect(screen.getByTestId('tab-home')).toBeSelected();
    expect(screen.getByTestId('tab-events')).not.toBeSelected();
  });

  it.each([
    ['events', '/events', 'Events'],
    ['chapter', '/chapter', 'Chapter'],
    ['profile', '/profile', 'Profile'],
  ])('tapping %s switches to that tab', async (name, path, title) => {
    await renderRouter(APP, { initialUrl: '/home' });
    await act(async () => {
      fireEvent.press(screen.getByTestId(`tab-${name}`));
    });
    await waitFor(() => expect(screen).toHavePathname(path));
    expect(screen.getByRole('header', { name: title })).toBeTruthy();
    expect(screen.getByTestId(`tab-${name}`)).toBeSelected();
    expect(screen.getByTestId('tab-home')).not.toBeSelected();
  });

  it('the Post tab opens the create flow as a modal instead of switching tabs', async () => {
    await renderRouter(APP, { initialUrl: '/home' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('tab-post'));
    });
    await waitFor(() => expect(screen).toHavePathname('/new-post'));
    expect(screen.getByText('New post')).toBeTruthy();
  });

  it('Cancel closes the post modal and returns to where you were', async () => {
    await renderRouter(APP, { initialUrl: '/events' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('tab-post'));
    });
    await waitFor(() => expect(screen).toHavePathname('/new-post'));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    });
    await waitFor(() => expect(screen).toHavePathname('/events'));
  });
});

describe('each tab keeps its own stack', () => {
  it('returns to the screen you left when you come back to a tab', async () => {
    await renderRouter(APP, { initialUrl: '/home' });
    await testRouter.push('/home/detail');
    expect(screen.getByText('Home detail')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('tab-events'));
    });
    await waitFor(() => expect(screen).toHavePathname('/events'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('tab-home'));
    });
    await waitFor(() => expect(screen).toHavePathname('/home/detail'));
    expect(screen.getByText('Home detail')).toBeTruthy();
  });

  it('back inside a tab goes to that tab’s previous screen', async () => {
    await renderRouter(APP, { initialUrl: '/home' });
    await testRouter.push('/home/detail');
    await testRouter.back('/home');
  });
});
