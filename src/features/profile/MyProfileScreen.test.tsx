import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

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
    // Interests wait behind More details.
    await press(screen.getByTestId('profile-more'));
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
    expect(profile.fetchProfileStats).toHaveBeenCalledWith(uid);
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
        {
          id: 'p1',
          coverPath: 'posts/u/p1/a.jpg',
          photoCount: 2,
          caption: 'Service day',
          createdAt: null,
        },
      ],
    });
    await openProfile();
    await waitFor(() => expect(screen.getByTestId('profile-post-p1')).toBeTruthy());
    await waitFor(() => expect(profile.photoUrl).toHaveBeenCalledWith('posts/u/p1/a.jpg'));
  });

  it('keeps photos in the grid and text posts in their own tab', async () => {
    const day = 86_400_000;
    profile.setMockExtras({
      posts: [
        {
          id: 'p1',
          coverPath: 'posts/u/p1/a.jpg',
          photoCount: 3,
          caption: 'Service day',
          createdAt: null,
        },
        {
          id: 'p2',
          coverPath: 'posts/u/p2/a.jpg',
          photoCount: 1,
          caption: 'Gala',
          createdAt: null,
        },
        {
          id: 'p3',
          coverPath: null,
          photoCount: 0,
          caption: 'Hello',
          createdAt: new Date(Date.now() - 2 * day),
        },
      ],
    });
    await openProfile();
    await waitFor(() => expect(screen.getByTestId('profile-post-p1')).toBeTruthy());
    expect(screen.getByTestId('profile-post-p2')).toBeTruthy();
    expect(screen.queryByTestId('profile-post-p3')).toBeNull();
    expect(screen.queryByText('Hello')).toBeNull();
    // Only the post with more than one photo gets the stacked-squares icon.
    expect(screen.getAllByTestId('more-photos')).toHaveLength(1);
    await waitFor(() => expect(screen.getByLabelText('Service day, 3 photos')).toBeTruthy());

    await press(screen.getByRole('tab', { name: 'Text' }));
    expect(screen.getByTestId('profile-text-p3')).toHaveTextContent(/Hello/);
    expect(screen.getByTestId('profile-text-p3').props.accessibilityLabel).toMatch(/, 2d, Hello$/);
    // The name and when sit above the words, beside the member's photo.
    expect(screen.getByTestId('profile-text-p3')).toHaveTextContent(/· 2d/);
    expect(screen.queryByTestId('profile-grid')).toBeNull();
  });

  it('opens a post from the grid or the Text tab, and Back returns to the profile', async () => {
    profile.setMockExtras({
      posts: [
        {
          id: 'p1',
          coverPath: 'posts/u/p1/a.jpg',
          photoCount: 1,
          caption: 'Gala',
          createdAt: null,
        },
        { id: 'p3', coverPath: null, photoCount: 0, caption: 'Hello', createdAt: null },
      ],
    });
    const r = await renderRouter('src/app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen.getByTestId('profile-post-p1')).toBeTruthy());
    await press(screen.getByTestId('profile-post-p1'));
    expect(r.getPathname()).toBe('/profile/post/p1');
    await act(async () => router.back());
    await waitFor(() => expect(r.getPathname()).toBe('/profile'));
    await press(screen.getByRole('tab', { name: 'Text' }));
    await press(screen.getByTestId('profile-text-p3'));
    expect(r.getPathname()).toBe('/profile/post/p3');
  });

  it('refreshes when you come back, so a post you deleted is gone', async () => {
    profile.setMockExtras({
      posts: [
        {
          id: 'p1',
          coverPath: 'posts/u/p1/a.jpg',
          photoCount: 1,
          caption: 'Gala',
          createdAt: null,
        },
        {
          id: 'p2',
          coverPath: 'posts/u/p2/a.jpg',
          photoCount: 1,
          caption: 'Cookout',
          createdAt: null,
        },
      ],
      stats: { posts: 2, eventsAttended: 0, serviceHours: 0 },
    });
    const r = await renderRouter('src/app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen.getByTestId('profile-post-p1')).toBeTruthy());
    await press(screen.getByTestId('profile-post-p1'));
    expect(r.getPathname()).toBe('/profile/post/p1');
    // Deleted while it was open.
    profile.setMockExtras({
      posts: [
        {
          id: 'p2',
          coverPath: 'posts/u/p2/a.jpg',
          photoCount: 1,
          caption: 'Cookout',
          createdAt: null,
        },
      ],
      stats: { posts: 1, eventsAttended: 0, serviceHours: 0 },
    });
    await act(async () => router.back());
    await waitFor(() => expect(screen.queryByTestId('profile-post-p1')).toBeNull());
    expect(screen.getByTestId('profile-post-p2')).toBeTruthy();
    expect(screen.getByLabelText('1 Posts')).toBeTruthy();
    // It kept showing the grid while it reloaded, rather than "Loading posts…".
    expect(screen.queryByText('Loading posts…')).toBeNull();
  });

  it('opens your check-in code from your profile', async () => {
    const r = await renderRouter('src/app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen.getByTestId('open-check-in-code')).toBeTruthy());
    await press(screen.getByTestId('open-check-in-code'));
    expect(r.getPathname()).toBe('/profile/check-in-code');
    await waitFor(() =>
      expect(screen.getByTestId('check-in-code').props.accessibilityLabel).toBe(
        'Check-in code for Marcus Reed',
      ),
    );
  });

  it('shows posts you were tagged in under Tagged, with who posted them', async () => {
    profile.setMockExtras({
      posts: [
        {
          id: 'p1',
          coverPath: 'posts/u/p1/a.jpg',
          photoCount: 1,
          caption: 'Gala',
          createdAt: null,
        },
      ],
      tagged: [
        {
          id: 't1',
          coverPath: 'posts/z/t1/a.jpg',
          photoCount: 1,
          caption: 'Cleanup crew',
          createdAt: null,
          author: { uid: 'sample-zed', displayName: 'Sample Zed', photoURL: null },
        },
        {
          id: 't2',
          coverPath: null,
          photoCount: 0,
          caption: 'Shout out to the brothers who came',
          createdAt: null,
          author: { uid: 'sample-ava', displayName: 'Sample Ava', photoURL: null },
        },
      ],
    });
    const r = await renderRouter('src/app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Tagged' })).toBeTruthy());
    await press(screen.getByRole('tab', { name: 'Tagged' }));
    expect(screen.getByTestId('profile-post-t1')).toBeTruthy();
    expect(screen.getByTestId('profile-text-t2').props.accessibilityLabel).toBe(
      'Sample Ava, Shout out to the brothers who came',
    );
    await press(screen.getByTestId('profile-post-t1'));
    expect(r.getPathname()).toBe('/profile/post/t1');
  });

  it('has no Tagged tab when nobody tagged you', async () => {
    profile.setMockExtras({
      posts: [
        {
          id: 'p1',
          coverPath: 'posts/u/p1/a.jpg',
          photoCount: 1,
          caption: 'Gala',
          createdAt: null,
        },
      ],
    });
    await openProfile();
    await waitFor(() => expect(screen.getByTestId('profile-post-p1')).toBeTruthy());
    expect(screen.queryByRole('tab', { name: 'Tagged' })).toBeNull();
  });

  it('with only text posts, Photos says so and the Text tab has them', async () => {
    profile.setMockExtras({
      posts: [{ id: 'p3', coverPath: null, photoCount: 0, caption: 'Hello', createdAt: null }],
    });
    await openProfile();
    await waitFor(() =>
      expect(screen.getByText('Your photo posts will show up here.')).toBeTruthy(),
    );
    await press(screen.getByRole('tab', { name: 'Text' }));
    expect(screen.getByTestId('profile-text-p3')).toHaveTextContent(/Hello/);
  });

  it('the plus in the top left starts a new post, and there’s no Profile title', async () => {
    const r = await renderRouter('src/app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen.getByTestId('profile-header-new-post')).toBeTruthy());
    expect(screen.queryByRole('header', { name: 'Profile' })).toBeNull();
    // The chapter monogram in the middle, like Home.
    expect(
      within(screen.getByTestId('profile-monogram')).getByLabelText('Sigma Sigma Lambda'),
    ).toBeTruthy();
    expect(screen.getByTestId('profile-header-new-post').props.accessibilityLabel).toBe(
      'Create a post',
    );
    await press(screen.getByTestId('profile-header-new-post'));
    await waitFor(() => expect(r.getPathname()).toBe('/new-post'));
  });

  it('invites you to share your first post when you have none', async () => {
    const r = await renderRouter('src/app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen.getByTestId('profile-empty')).toBeTruthy());
    expect(screen.getByText('Share your first post')).toBeTruthy();
    await press(screen.getByTestId('profile-new-post'));
    expect(r.getPathname()).toBe('/new-post');
  });

  it('lists attended events in the Activity tab with the privacy note', async () => {
    events.resetEventsMock([]);
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
    await waitFor(() => expect(screen.getByTestId('activity-attended-e1')).toBeTruthy());
    expect(screen.getByText('Q2 Service Day')).toBeTruthy();
    expect(screen.getByText('Attended · Food bank · 4 service hours')).toBeTruthy();
    expect(screen.getByText('OCT')).toBeTruthy();
    expect(screen.getByText('Attended · Library')).toBeTruthy();
    expect(screen.getByText('Only you and chapter officers can see your check-ins.')).toBeTruthy();
    // Tapping a check-in opens the event.
    await press(screen.getByTestId('activity-attended-e1'));
    await waitFor(() => expect(screen).toHavePathname('/events/e1'));
  });

  it('shows events you’re going to under Coming up', async () => {
    events.resetEventsMock([
      events.sampleEvent({ id: 'gala', title: 'Sample gala', myRsvp: 'going' }),
      events.sampleEvent({ id: 'maybe', title: 'Sample maybe', myRsvp: 'maybe' }),
    ]);
    await openProfile();
    await press(screen.getByRole('tab', { name: 'Activity' }));
    await waitFor(() => expect(screen.getByTestId('activity-going-gala')).toBeTruthy());
    expect(screen.queryByTestId('activity-going-maybe')).toBeNull();
    // His own RSVPs: the upcoming events are loaded for him.
    expect(events.fetchUpcomingEvents).toHaveBeenCalledWith(auth.sampleUser().uid);
  });

  it('shows an empty Activity tab before anything happens', async () => {
    events.resetEventsMock([]);
    await openProfile();
    await press(screen.getByRole('tab', { name: 'Activity' }));
    await waitFor(() =>
      expect(screen.getByText('Your posts, RSVPs and check-ins will show up here.')).toBeTruthy(),
    );
  });

  it('offers a retry when posts fail to load, and retrying reloads', async () => {
    profile.setMockExtras({ fail: true });
    await openProfile();
    await waitFor(() => expect(screen.getByText('Couldn’t load posts.')).toBeTruthy());
    profile.setMockExtras({
      fail: false,
      posts: [
        {
          id: 'p9',
          coverPath: 'posts/u/p9/a.jpg',
          photoCount: 1,
          caption: 'Back online',
          createdAt: null,
        },
      ],
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
