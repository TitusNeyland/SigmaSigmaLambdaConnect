import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
const profile = jest.requireMock<typeof import('@/data/__mocks__/profile')>('@/data/profile');
jest.mock('@/data/blocks');
const blocks = jest.requireMock<typeof import('@/data/__mocks__/blocks')>('@/data/blocks');
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
const feed = jest.requireMock<typeof import('@/data/__mocks__/feed')>('@/data/feed');

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

const POSTS = Array.from({ length: 7 }, (_, i) =>
  feed.samplePost({
    id: `p${i + 1}`,
    authorId: i === 1 ? 'sample-chris' : 'sample-marcus',
    author: {
      uid: i === 1 ? 'sample-chris' : 'sample-marcus',
      displayName: i === 1 ? 'Chris Baptiste' : 'Marcus Reed',
      photoURL: null,
      headline: 'Software engineer',
      initiationTerm: 'Spring 2019',
      role: i === 0 ? { role: 'officer', title: 'Treasurer' } : null,
    },
    caption: `Sample post ${i + 1}`,
    createdAt: hoursAgo(i + 1),
  }),
);

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function endReached() {
  await act(async () => {
    fireEvent(screen.getByTestId('feed'), 'endReached');
  });
}

const shown = () =>
  screen.queryAllByTestId(/^post-p\d+$/).map((el) => String(el.props.testID).replace('post-', ''));

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  roles.resetRolesMock(null);
  profile.resetProfileMock();
  blocks.resetBlocksMock();
  events.resetEventsMock([]);
  feed.resetFeedMock(POSTS);
  auth.setMockUser(auth.sampleUser());
});

async function openHome() {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('post-p1')).toBeTruthy());
}

it('shows the newest posts first with LinkedIn-style author lines', async () => {
  await openHome();
  expect(feed.fetchFeedPage).toHaveBeenCalledWith(auth.sampleUser().uid);
  expect(shown()).toEqual(['p1', 'p2', 'p3']);
  expect(screen.getByTestId('post-author-p1').props.accessibilityLabel).toBe(
    'Marcus Reed, Treasurer · Initiated 2019 · Software engineer, 1h',
  );
  expect(screen.getByTestId('caption-p1')).toHaveTextContent(/^Sample post 1$/);
});

it('shows a text-only post like a tweet, with the text right under the author', async () => {
  feed.resetFeedMock([feed.samplePost({ id: 'p1', caption: 'Chapter meeting moved to 7' })]);
  await openHome();
  const text = screen.getByTestId('caption-p1');
  // No "Name caption" prefix and no photo area.
  expect(text).toHaveTextContent(/^Chapter meeting moved to 7$/);
  expect(screen.queryByTestId(/^photo-/)).toBeNull();
  expect(screen.getByTestId('like-p1')).toBeTruthy();
});

it('lines up likes and comments the same on text and photo posts', async () => {
  feed.resetFeedMock([
    feed.samplePost({ id: 'p1', caption: 'Chapter meeting moved to 7' }),
    feed.samplePost({ id: 'p2', caption: 'Gala night', photoPaths: ['posts/a/p2/0.jpg'] }),
  ]);
  await openHome();
  const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
  expect(style('actions-p1')).toEqual(style('actions-p2'));
  expect(style('post-body-p1')).toEqual(style('post-body-p2'));
  // The text of a post without photos starts at the same left edge as the comments.
  expect(style('caption-p1').paddingHorizontal).toBe(style('post-body-p1').paddingHorizontal);
});

it('keeps the Instagram-style caption on photo posts', async () => {
  feed.resetFeedMock([
    feed.samplePost({ id: 'p1', caption: 'Gala night', photoPaths: ['posts/a/p1/0.jpg'] }),
  ]);
  await openHome();
  await waitFor(() => expect(screen.getByTestId('photo-posts/a/p1/0.jpg')).toBeTruthy());
  expect(screen.getByTestId('caption-p1')).toHaveTextContent('Marcus Reed Gala night');
});

it('loads the next page as you scroll, without repeats', async () => {
  await openHome();
  await endReached();
  await waitFor(() => expect(shown()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']));
  expect(feed.fetchFeedPage).toHaveBeenLastCalledWith(auth.sampleUser().uid, 3);
  await endReached();
  await waitFor(() => expect(shown()).toHaveLength(7));
  // No more pages: scrolling further asks for nothing.
  const calls = feed.fetchFeedPage.mock.calls.length;
  await endReached();
  expect(feed.fetchFeedPage.mock.calls.length).toBe(calls);
});

it('offers Load more when a later page fails', async () => {
  await openHome();
  feed.failFeedLoad();
  await endReached();
  await waitFor(() => expect(screen.getByTestId('feed-more')).toBeTruthy());
  await press(screen.getByTestId('feed-more'));
  await waitFor(() => expect(shown()).toHaveLength(6));
});

it('pull to refresh starts over with the newest posts', async () => {
  await openHome();
  feed.setMockPosts([feed.samplePost({ id: 'p0', caption: 'Brand new' }), ...POSTS]);
  await act(async () => {
    fireEvent(screen.getByTestId('feed'), 'refresh');
  });
  await waitFor(() => expect(shown()[0]).toBe('p0'));
});

it('hides posts from people I blocked, right away', async () => {
  await openHome();
  expect(shown()).toContain('p2');
  await act(async () =>
    blocks.setMockBlocked([{ uid: 'sample-chris', displayName: 'Chris Baptiste', photoURL: null }]),
  );
  expect(shown()).not.toContain('p2');
});

it('has no upcoming events strip, even with events coming up', async () => {
  events.resetEventsMock([events.sampleEvent({ id: 'meeting', title: 'Sample chapter meeting' })]);
  await openHome();
  expect(screen.queryByTestId('events-strip')).toBeNull();
  expect(screen.queryByText('Upcoming')).toBeNull();
  expect(events.fetchUpcomingEvents).not.toHaveBeenCalled();
});

it('shows photos at the post’s shape, so wide photos show wide', async () => {
  feed.resetFeedMock([
    feed.samplePost({ id: 'p1', photoPaths: ['posts/a/p1/0.jpg'], aspectRatio: 16 / 9 }),
    feed.samplePost({ id: 'p2', photoPaths: ['posts/a/p2/0.jpg'] }),
  ]);
  await openHome();
  const size = (path: string) =>
    StyleSheet.flatten(screen.getByTestId(`photo-frame-${path}`).props.style);
  const wide = size('posts/a/p1/0.jpg');
  expect(wide.height).toBe(Math.round(wide.width / (16 / 9)));
  // Posts from before framing stay square.
  const square = size('posts/a/p2/0.jpg');
  expect(square.height).toBe(square.width);
});

it('shows photos and links comments and authors', async () => {
  feed.resetFeedMock([
    feed.samplePost({
      id: 'p1',
      photoPaths: ['posts/a/p1/0.jpg', 'posts/a/p1/1.jpg'],
      commentCount: 4,
    }),
  ]);
  await openHome();
  await waitFor(() => expect(screen.getByTestId('photo-posts/a/p1/0.jpg')).toBeTruthy());
  expect(screen.getByLabelText('Photo from Marcus Reed, photo 1 of 2')).toBeTruthy();
  await press(screen.getByTestId('comments-p1'));
  await waitFor(() => expect(screen).toHavePathname('/home/comments/p1'));
});

describe('comments under a post', () => {
  const withComments = (overrides = {}) =>
    feed.samplePost({
      id: 'p1',
      commentCount: 5,
      previewComments: [
        { id: 'c1', authorId: 'sample-chris', authorName: 'Chris Baptiste', text: 'Great night' },
        { id: 'c2', authorId: 'sample-zed', authorName: 'Zed Allen', text: 'See you Saturday' },
      ],
      ...overrides,
    });

  it('shows the count by the comment icon and the newest comments under the caption', async () => {
    feed.resetFeedMock([withComments()]);
    await openHome();
    expect(screen.getByTestId('comment-count-p1')).toHaveTextContent('5');
    expect(screen.getByTestId('comment-p1').props.accessibilityLabel).toBe('Comment, 5 comments');
    expect(screen.getByTestId('comments-p1')).toHaveTextContent('View all 5 comments');
    expect(screen.getByTestId('preview-comment-c1')).toHaveTextContent(
      'Chris Baptiste Great night',
    );
    expect(screen.getByTestId('preview-comment-c2')).toHaveTextContent(
      'Zed Allen See you Saturday',
    );
  });

  it('opens the comments sheet from a previewed comment', async () => {
    feed.resetFeedMock([withComments()]);
    await openHome();
    await press(screen.getByTestId('preview-comment-c2'));
    await waitFor(() => expect(screen).toHavePathname('/home/comments/p1'));
  });

  it('hides a previewed comment from someone the member blocked', async () => {
    feed.resetFeedMock([withComments()]);
    await openHome();
    await act(async () =>
      blocks.setMockBlocked([
        { uid: 'sample-chris', displayName: 'Chris Baptiste', photoURL: null },
      ]),
    );
    await waitFor(() => expect(screen.queryByTestId('preview-comment-c1')).toBeNull());
    expect(screen.getByTestId('preview-comment-c2')).toBeTruthy();
  });

  it('shows no count or previews when there are no comments, or comments are off', async () => {
    feed.resetFeedMock([
      feed.samplePost({ id: 'p1' }),
      withComments({ id: 'p2', allowComments: false }),
    ]);
    await openHome();
    expect(screen.queryByTestId('comment-count-p1')).toBeNull();
    expect(screen.getByTestId('comment-p1').props.accessibilityLabel).toBe('Comment');
    expect(screen.queryByTestId('preview-comment-c1')).toBeNull();
  });
});

it('opens the author’s profile', async () => {
  await openHome();
  await press(screen.getByTestId('post-author-p2'));
  await waitFor(() => expect(screen).toHavePathname('/chapter/member/sample-chris'));
});

it('expands a long caption', async () => {
  feed.resetFeedMock([feed.samplePost({ id: 'p1', caption: `${'word '.repeat(40)}end` })]);
  await openHome();
  expect(screen.getByTestId('caption-p1')).not.toHaveTextContent(/end$/);
  await press(screen.getByTestId('more-p1'));
  expect(screen.getByTestId('caption-p1')).toHaveTextContent(/end$/);
});

it('has an empty state and a retry', async () => {
  feed.resetFeedMock([]);
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('feed-empty')).toBeTruthy());

  feed.resetFeedMock(POSTS);
  feed.failFeedLoad();
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByText('Couldn’t load the feed.')).toBeTruthy());
  await press(screen.getByTestId('feed-retry'));
  await waitFor(() => expect(screen.getByTestId('post-p1')).toBeTruthy());
});
