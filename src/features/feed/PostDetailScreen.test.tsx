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
const comments = jest.requireMock<typeof import('@/data/__mocks__/comments')>('@/data/comments');

const me = () => auth.sampleUser().uid;

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function type(text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('comment-input'), text);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  blocks.resetBlocksMock();
  comments.resetCommentsMock();
  feed.resetFeedMock([
    feed.samplePost({ id: 'p1', caption: 'Sample gala photos', commentCount: 2 }),
  ]);
  comments.setMockComments('p1', [
    comments.sampleComment({ id: 'c1', text: 'Great night', likeCount: 3 }),
    comments.sampleComment({
      id: 'c2',
      authorId: 'sample-zed',
      author: {
        uid: 'sample-zed',
        displayName: 'Zed Allen',
        photoURL: null,
        headline: '',
        initiationTerm: '',
        role: null,
      },
      text: 'Agreed',
      replyToId: 'c1',
    }),
  ]);
  auth.setMockUser(auth.sampleUser());
});

async function openPost(id = 'p1') {
  await renderRouter('src/app', { initialUrl: `/home/post/${id}` });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
}

const rows = () =>
  screen
    .queryAllByTestId(/^comment-c\d+$|^comment-new-\d+$/)
    .map((r) => String(r.props.testID).replace('comment-', ''));

it('shows the post, then its comments with replies threaded', async () => {
  await openPost();
  expect(screen.getByTestId('caption-p1')).toHaveTextContent('Marcus Reed Sample gala photos');
  expect(screen.getByTestId('comment-count')).toHaveTextContent('2 comments');
  expect(rows()).toEqual(['c1', 'c2']);
  expect(screen.getByTestId('comment-text-c1')).toHaveTextContent('Chris Baptiste Great night');
  expect(screen.getByTestId('comment-likes-c1')).toHaveTextContent('3 likes');
  // No comment button on the post's own screen.
  expect(screen.queryByTestId('comment-p1')).toBeNull();
});

it('Post stays off until there’s something to say, then adds the comment and updates the count', async () => {
  await openPost();
  const post = () => screen.getByTestId('comment-post');
  expect(post().props.accessibilityState).toMatchObject({ disabled: true });
  await type('   ');
  expect(post().props.accessibilityState).toMatchObject({ disabled: true });
  await type('See everyone Saturday');
  expect(post().props.accessibilityState).toMatchObject({ disabled: false });
  await press(post());
  expect(comments.addComment).toHaveBeenCalledWith('p1', me(), 'See everyone Saturday', null);
  await waitFor(() => expect(screen.getByTestId('comment-count')).toHaveTextContent('3 comments'));
  expect(screen.getByTestId('comment-input').props.value).toBe('');
  expect(screen.getByTestId('comment-text-new-1')).toHaveTextContent('You See everyone Saturday');
});

it('replies to a comment', async () => {
  await openPost();
  await press(screen.getByRole('button', { name: 'Reply to Chris Baptiste' }));
  expect(screen.getByTestId('replying-to')).toHaveTextContent(/^Replying to Chris Baptiste/);
  await type('Thanks!');
  await press(screen.getByTestId('comment-post'));
  expect(comments.addComment).toHaveBeenCalledWith('p1', me(), 'Thanks!', 'c1');
  await waitFor(() => expect(rows()).toEqual(['c1', 'c2', 'new-1']));
  expect(screen.queryByTestId('replying-to')).toBeNull();
});

it('cancels a reply', async () => {
  await openPost();
  await press(screen.getByRole('button', { name: 'Reply to Chris Baptiste' }));
  await press(screen.getByTestId('reply-cancel'));
  await type('Top level');
  await press(screen.getByTestId('comment-post'));
  expect(comments.addComment).toHaveBeenCalledWith('p1', me(), 'Top level', null);
});

it('keeps the text and says so when a comment fails', async () => {
  comments.addComment.mockRejectedValueOnce(new Error('offline'));
  await openPost();
  await type('Keep me');
  await press(screen.getByTestId('comment-post'));
  await waitFor(() => expect(screen.getByTestId('comment-error')).toBeTruthy());
  expect(screen.getByTestId('comment-input').props.value).toBe('Keep me');
});

it('likes a comment with instant feedback', async () => {
  await openPost();
  await press(screen.getByTestId('comment-like-c1'));
  expect(comments.likeComment).toHaveBeenCalledWith('p1', 'c1', me());
  expect(screen.getByTestId('comment-likes-c1')).toHaveTextContent('4 likes');
  expect(screen.getByTestId('comment-like-c1').props.accessibilityLabel).toBe('Unlike comment');
});

it('hides comments from blocked members', async () => {
  blocks.resetBlocksMock([{ uid: 'sample-chris', displayName: 'Chris Baptiste', photoURL: null }]);
  await openPost();
  await waitFor(() => expect(rows()).toEqual(['c2']));
});

it('has no input when comments are off', async () => {
  feed.resetFeedMock([feed.samplePost({ id: 'p1', allowComments: false })]);
  comments.setMockComments('p1', []);
  await openPost();
  expect(screen.queryByTestId('comment-input')).toBeNull();
  expect(screen.getByText('Comments are off for this post.')).toBeTruthy();
});

it('says when a post is gone, and retries a failed load', async () => {
  await openPost('missing');
  expect(screen.getByText('This post isn’t available. It may have been deleted.')).toBeTruthy();

  feed.failFeedLoad();
  await openPost();
  expect(screen.getByText('Couldn’t load this post.')).toBeTruthy();
  await press(screen.getByTestId('post-retry'));
  await waitFor(() => expect(screen.getByTestId('caption-p1')).toBeTruthy());
});

it('opens from the feed and goes back', async () => {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('comments-p1')).toBeTruthy());
  await press(screen.getByTestId('comments-p1'));
  await waitFor(() => expect(screen.getByTestId('comment-count')).toBeTruthy());
  await press(screen.getByTestId('post-back'));
  await waitFor(() => expect(screen).toHavePathname('/home'));
});
