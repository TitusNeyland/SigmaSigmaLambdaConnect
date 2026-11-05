import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
const blocks = jest.requireMock<typeof import('@/data/__mocks__/blocks')>('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
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
// Mocked for every app test in jest.setup.js.
const activity = jest.requireMock<typeof import('@/data/__mocks__/activity')>('@/data/activity');

const HOUR = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * HOUR);

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  blocks.resetBlocksMock();
  feed.resetFeedMock([feed.samplePost({ id: 'p1' })]);
  activity.resetActivityMock([
    activity.sampleActivity({
      id: 'comment_c1',
      type: 'comment',
      actorId: 'sample-zed',
      actorName: 'Sample Zed',
      commentId: 'c1',
      text: 'Great night',
      photoPath: 'posts/me/p1/0.jpg',
      at: ago(1),
    }),
    activity.sampleActivity({ id: 'like_p1_sample-chris', at: ago(2) }),
    activity.sampleActivity({
      id: 'like_p1_sample-ava',
      actorId: 'sample-ava',
      actorName: 'Sample Ava',
      at: ago(3),
    }),
    activity.sampleActivity({
      id: 'reply_c9',
      type: 'reply',
      actorId: 'sample-ben',
      actorName: 'Sample Ben',
      postId: 'p9',
      commentId: 'c9',
      text: 'Me too',
      at: ago(30),
    }),
  ]);
  activity.setMockSeen(ago(10));
  auth.setMockUser(auth.sampleUser());
});

async function openHome() {
  const r = await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('home-activity')).toBeTruthy());
  return r;
}

async function openActivity() {
  const r = await renderRouter('src/app', { initialUrl: '/home/activity' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  return r;
}

describe('the top of Home', () => {
  it('has a plus for a new post, the monogram, and the heart', async () => {
    const r = await openHome();
    expect(screen.getByRole('header', { name: 'Sigma Sigma Lambda' })).toBeTruthy();
    await press(screen.getByTestId('home-new-post'));
    expect(r.getPathname()).toBe('/new-post');
  });

  it('shows a dot on the heart when there’s something new, until they look', async () => {
    const r = await openHome();
    await waitFor(() => expect(screen.getByTestId('home-activity-dot')).toBeTruthy());
    expect(screen.getByTestId('home-activity').props.accessibilityLabel).toBe('Activity, new');
    await press(screen.getByTestId('home-activity'));
    expect(r.getPathname()).toBe('/home/activity');
    await waitFor(() => expect(activity.markActivitySeen).toHaveBeenCalled());
    await press(screen.getByTestId('activity-back'));
    await waitFor(() => expect(screen.queryByTestId('home-activity-dot')).toBeNull());
  });

  it('shows no dot when nothing is new', async () => {
    activity.setMockSeen(new Date());
    await openHome();
    await waitFor(() => expect(activity.fetchActivitySeen).toHaveBeenCalled());
    expect(screen.queryByTestId('home-activity-dot')).toBeNull();
    expect(screen.getByTestId('home-activity').props.accessibilityLabel).toBe('Activity');
  });
});

describe('Activity', () => {
  it('lists what’s new, then earlier, with likes on a post grouped', async () => {
    await openActivity();
    expect(screen.getByTestId('activity-section-new')).toBeTruthy();
    expect(screen.getByTestId('activity-section-earlier')).toBeTruthy();
    expect(screen.getByTestId('activity-comment_c1').props.accessibilityLabel).toBe(
      'Sample Zed commented: Great night 1h',
    );
    expect(screen.getByTestId('activity-like_p1_sample-chris').props.accessibilityLabel).toBe(
      'Sample Chris and Sample Ava liked your post. 2h',
    );
    expect(screen.queryByTestId('activity-like_p1_sample-ava')).toBeNull();
    expect(screen.getByTestId('activity-reply_c9').props.accessibilityLabel).toMatch(
      /^Sample Ben replied to your comment: Me too/,
    );
    expect(activity.markActivitySeen).toHaveBeenCalledWith(auth.sampleUser().uid);
  });

  it('opens the post for a like, and the comments for a comment', async () => {
    const r = await openActivity();
    await press(screen.getByTestId('activity-like_p1_sample-chris'));
    expect(r.getPathname()).toBe('/home/post/p1');
    await act(async () => router.back());
    await press(screen.getByTestId('activity-comment_c1'));
    expect(r.getPathname()).toBe('/home/comments/p1');
  });

  it('leaves out people they blocked', async () => {
    blocks.setMockBlocked([{ uid: 'sample-zed', displayName: 'Sample Zed', photoURL: null }]);
    await openActivity();
    expect(screen.queryByTestId('activity-comment_c1')).toBeNull();
    expect(screen.getByTestId('activity-like_p1_sample-chris')).toBeTruthy();
  });

  it('says so when there’s nothing yet', async () => {
    activity.resetActivityMock([]);
    await openActivity();
    expect(screen.getByTestId('activity-empty')).toHaveTextContent(/No activity yet/);
  });

  it('offers Try again when it can’t load', async () => {
    activity.failActivityLoad();
    await openActivity();
    await press(screen.getByTestId('activity-retry'));
    await waitFor(() => expect(screen.getByTestId('activity-comment_c1')).toBeTruthy());
  });
});
