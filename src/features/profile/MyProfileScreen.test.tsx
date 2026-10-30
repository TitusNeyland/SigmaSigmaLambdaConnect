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
const profile = jest.requireMock<typeof import('@/data/__mocks__/profile')>('@/data/profile');

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
  roles.resetRolesMock(null);
  profile.resetProfileMock();
  auth.setMockUser(auth.sampleUser());
});

async function openProfile() {
  await renderRouter('src/app', { initialUrl: '/profile' });
  await waitFor(() => expect(screen.getByRole('header', { name: 'Marcus Reed' })).toBeTruthy());
}

describe('My profile', () => {
  it('shows name, headline with initiation, bio and interests', async () => {
    await openProfile();
    expect(screen.getByText('Software engineer · Initiated Spring 2019')).toBeTruthy();
    expect(screen.getByText('Mentoring chair. Happy to review a resume.')).toBeTruthy();
    expect(screen.getByText('Tech')).toBeTruthy();
    expect(screen.getByText('Career mentoring')).toBeTruthy();
  });

  it('loads only the signed-in member’s own data, with attendance', async () => {
    await openProfile();
    const uid = auth.sampleUser().uid;
    expect(profile.subscribeToProfile).toHaveBeenCalledWith(
      uid,
      expect.any(Function),
      expect.any(Function),
      { own: true },
    );
    expect(profile.fetchProfileStats).toHaveBeenCalledWith(uid, { includeAttendance: true });
    expect(profile.fetchActivity).toHaveBeenCalledWith(uid);
  });

  it('shows counts for posts, events attended and service hours', async () => {
    profile.setMockExtras({ stats: { posts: 24, eventsAttended: 9, serviceHours: 32 } });
    await openProfile();
    await waitFor(() => expect(screen.getByLabelText('24 Posts')).toBeTruthy());
    expect(screen.getByLabelText('9 Events')).toBeTruthy();
    expect(screen.getByLabelText('32 Service hrs')).toBeTruthy();
  });

  it('shows no role badge for regular members', async () => {
    await openProfile();
    expect(screen.queryByTestId('role-chip')).toBeNull();
  });

  it('shows the officer title as a role badge', async () => {
    roles.resetRolesMock({ role: 'officer', title: 'Mentoring Chair' });
    await openProfile();
    await waitFor(() =>
      expect(screen.getByTestId('role-chip')).toHaveTextContent('Mentoring Chair'),
    );
  });

  it('leaves out a missing headline without a stray separator', async () => {
    profile.resetProfileMock(profile.sampleProfile({ headline: '' }));
    await openProfile();
    expect(screen.getByText('Initiated Spring 2019')).toBeTruthy();
  });

  it('shows a post grid with one tile per post', async () => {
    profile.setMockExtras({
      posts: [
        { id: 'p1', coverPath: 'posts/u/p1/a.jpg', photoCount: 2, caption: 'Service day' },
        { id: 'p2', coverPath: null, photoCount: 0, caption: 'Text only post' },
      ],
    });
    await openProfile();
    await waitFor(() => expect(screen.getByTestId('profile-post-p1')).toBeTruthy());
    expect(screen.getByTestId('profile-post-p2')).toBeTruthy();
    expect(screen.getByText('Text only post')).toBeTruthy();
    await waitFor(() => expect(profile.photoUrl).toHaveBeenCalledWith('posts/u/p1/a.jpg'));
  });

  it('shows a friendly empty state with no posts', async () => {
    await openProfile();
    await waitFor(() => expect(screen.getByText('Your posts will show up here.')).toBeTruthy());
  });

  it('lists attended events in the Activity tab with the privacy note', async () => {
    profile.setMockExtras({
      activity: [
        {
          eventId: 'e1',
          title: 'Q2 Service Day',
          location: 'Food bank',
          startsAt: new Date(2026, 9, 3),
          serviceHours: 4,
        },
        {
          eventId: 'e2',
          title: 'Chapter Meeting',
          location: 'Library',
          startsAt: null,
          serviceHours: 0,
        },
      ],
    });
    await openProfile();
    await press(screen.getByRole('tab', { name: 'Activity' }));
    await waitFor(() => expect(screen.getByTestId('activity-e1')).toBeTruthy());
    expect(screen.getByText('Q2 Service Day')).toBeTruthy();
    expect(screen.getByText('Food bank · 4 service hours')).toBeTruthy();
    expect(screen.getByText('OCT')).toBeTruthy();
    expect(screen.getByText('Library')).toBeTruthy();
    expect(
      screen.getByText('Only you and chapter officers can see your attendance history.'),
    ).toBeTruthy();
  });

  it('shows an empty Activity tab before any check-ins', async () => {
    await openProfile();
    await press(screen.getByRole('tab', { name: 'Activity' }));
    await waitFor(() =>
      expect(screen.getByText('Events you’re checked in at will show up here.')).toBeTruthy(),
    );
  });

  it('offers a retry when posts fail to load, and retrying reloads', async () => {
    profile.setMockExtras({ fail: true });
    await openProfile();
    await waitFor(() => expect(screen.getByText('Couldn’t load posts.')).toBeTruthy());
    profile.setMockExtras({
      fail: false,
      posts: [{ id: 'p9', coverPath: null, photoCount: 0, caption: 'Back online' }],
    });
    await press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('profile-post-p9')).toBeTruthy());
  });

  it('updates live when the profile changes', async () => {
    await openProfile();
    await act(async () => profile.setMockProfile(profile.sampleProfile({ bio: 'New bio here.' })));
    await waitFor(() => expect(screen.getByText('New bio here.')).toBeTruthy());
  });

  it('opens Edit profile', async () => {
    await openProfile();
    await press(screen.getByTestId('edit-profile'));
    await waitFor(() => expect(screen).toHavePathname('/profile/edit'));
  });

  it('opens Settings from the menu button', async () => {
    await openProfile();
    await press(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(screen).toHavePathname('/profile/settings'));
  });

  it('shows a message if the profile can’t load', async () => {
    profile.subscribeToProfile.mockImplementationOnce(
      (_uid: string, _onChange: unknown, onError: (e: unknown) => void) => {
        onError(new Error('offline'));
        return () => {};
      },
    );
    await renderRouter('src/app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen.getByText('Couldn’t load your profile.')).toBeTruthy());
  });
});
