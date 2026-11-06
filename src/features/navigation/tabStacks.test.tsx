import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
const directory = jest.requireMock<typeof import('@/data/__mocks__/directory')>('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
const events = jest.requireMock<typeof import('@/data/__mocks__/events')>('@/data/events');
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

beforeEach(async () => {
  await AsyncStorage.clear();
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  events.resetEventsMock([events.sampleEvent({ id: 'e1', title: 'Sample meeting' })]);
  directory.resetDirectoryMock([
    directory.sampleEntry({ uid: auth.sampleUser().uid, displayName: 'Marcus Reed' }),
    directory.sampleEntry({ uid: 'sample-zed', displayName: 'Zed Allen' }),
  ]);
  auth.setMockUser(auth.sampleUser());
});

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

// Opening a screen in another tab (like Home's welcome card opening Edit profile) keeps that
// tab's first screen underneath it, so leaving lands there and the tab never gets stuck.
it('Edit profile opened from Home’s welcome card leaves to the profile, not a stuck tab', async () => {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('welcome-photo')).toBeTruthy());
  await press('welcome-photo');
  await waitFor(() => expect(screen.getByTestId('edit-cancel')).toBeTruthy());
  await press('edit-cancel');
  await waitFor(() => expect(screen).toHavePathname('/profile'));
  // And the Profile tab opens on the profile from then on.
  await press('tab-home');
  await press('tab-profile');
  await waitFor(() => expect(screen).toHavePathname('/profile'));
  expect(screen.queryByTestId('edit-cancel')).toBeNull();
});

it('an event opened from another tab leaves to the Events list', async () => {
  events.resetEventsMock([
    events.sampleEvent({ id: 'e1', title: 'Sample meeting', myRsvp: 'going' }),
  ]);
  await renderRouter('src/app', { initialUrl: '/profile' });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Activity' })).toBeTruthy());
  await act(async () => {
    fireEvent.press(screen.getByRole('tab', { name: 'Activity' }));
  });
  await waitFor(() => expect(screen.getByTestId('activity-going-e1')).toBeTruthy());
  await press('activity-going-e1');
  await waitFor(() => expect(screen).toHavePathname('/events/e1'));
  await press('tab-home');
  await press('tab-events');
  await waitFor(() => expect(screen).toHavePathname('/events/e1'));
  // Back from the event lands on the list in the Events tab.
  await press('event-back');
  await waitFor(() => expect(screen).toHavePathname('/events'));
});

describe('your own name in the Chapter tab', () => {
  const me = () => auth.sampleUser().uid;

  it('opens your Profile tab, and Chapter still opens Chapter afterwards', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter/directory' });
    await waitFor(() => expect(screen.getByTestId(`member-${me()}`)).toBeTruthy());
    await press(`member-${me()}`);
    await waitFor(() => expect(screen).toHavePathname('/profile'));
    await press('tab-chapter');
    await waitFor(() => expect(screen).toHavePathname('/chapter/directory'));
    // Other brothers still open their page in the Chapter tab.
    await press('member-sample-zed');
    await waitFor(() => expect(screen).toHavePathname('/chapter/member/sample-zed'));
  });

  it('your own member page, opened some other way, sends you to Profile once', async () => {
    await renderRouter('src/app', { initialUrl: '/chapter' });
    await waitFor(() => expect(screen.getByTestId('tab-chapter')).toBeTruthy());
    await act(async () => {
      router.push({ pathname: '/chapter/member/[uid]', params: { uid: me() } });
    });
    await waitFor(() => expect(screen).toHavePathname('/profile'));
    // It didn't stay behind in the Chapter tab to bounce you again.
    await press('tab-chapter');
    await waitFor(() => expect(screen).toHavePathname('/chapter'));
    await press('tab-home');
    await press('tab-chapter');
    await waitFor(() => expect(screen).toHavePathname('/chapter'));
  });
});
