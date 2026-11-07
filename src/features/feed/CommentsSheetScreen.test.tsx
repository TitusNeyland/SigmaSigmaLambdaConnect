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
jest.mock('./pickCommentPhoto', () => ({ pickCommentPhoto: jest.fn() }));
const { pickCommentPhoto } =
  jest.requireMock<typeof import('./pickCommentPhoto')>('./pickCommentPhoto');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
const mod = jest.requireMock<typeof import('@/data/__mocks__/moderation')>('@/data/moderation');
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
  jest.mocked(pickCommentPhoto).mockReset();
  mod.resetModerationMock();
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

async function openFromFeed() {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('comment-p1')).toBeTruthy());
  await press(screen.getByTestId('comment-p1'));
  await waitFor(() => expect(screen.getByTestId('comments-sheet')).toBeTruthy());
  await waitFor(() => expect(screen.queryByText('Loading comments…')).toBeNull());
}

it('shows a photo on a comment that is just a picture', async () => {
  comments.setMockComments('p1', [
    comments.sampleComment({
      id: 'pic',
      text: '',
      photoPath: 'https://cdn.test/comment.jpg',
    }),
  ]);
  await openFromFeed();
  await waitFor(() => expect(screen.getByTestId('comment-photo-pic')).toBeTruthy());
  expect(screen.getByTestId('comment-text-pic')).toHaveTextContent('Chris Baptiste');
});

it('opens from the feed with the comments, replies threaded', async () => {
  await openFromFeed();
  expect(screen).toHavePathname('/home/comments/p1');
  expect(screen.getByRole('header', { name: 'Comments' })).toBeTruthy();
  expect(screen.getByTestId('comment-text-c1')).toHaveTextContent('Chris Baptiste Great night');
  expect(screen.getByTestId('comment-c2')).toBeTruthy();
  // The sheet is just the conversation, not the post again.
  expect(screen.queryByTestId('comment-count')).toBeNull();
  // Your own avatar sits beside the comment box, like Instagram.
  expect(screen.getByTestId('comment-avatar')).toBeTruthy();
});

it('opens from "View all comments" too', async () => {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('comments-p1')).toBeTruthy());
  await press(screen.getByTestId('comments-p1'));
  await waitFor(() => expect(screen).toHavePathname('/home/comments/p1'));
});

it('adds a comment from the sheet', async () => {
  await openFromFeed();
  await type('See everyone Saturday');
  await press(screen.getByTestId('comment-post'));
  expect(comments.addComment).toHaveBeenCalledWith('p1', me(), 'See everyone Saturday', null);
  await waitFor(() =>
    expect(screen.getByTestId('comment-text-new-1')).toHaveTextContent('You See everyone Saturday'),
  );
  expect(screen.getByTestId('comment-input').props.value).toBe('');
});

it('replies to a comment from the sheet', async () => {
  await openFromFeed();
  await press(screen.getByTestId('reply-c1'));
  expect(screen.getByTestId('replying-to')).toHaveTextContent(/^Replying to Chris Baptiste/);
  await type('Same here');
  await press(screen.getByTestId('comment-post'));
  expect(comments.addComment).toHaveBeenCalledWith('p1', me(), 'Same here', 'c1');
});

it('says when the post is gone', async () => {
  await renderRouter('src/app', { initialUrl: '/home/comments/missing' });
  await waitFor(() =>
    expect(screen.getByText('This post isn’t available. It may have been deleted.')).toBeTruthy(),
  );
  expect(screen.queryByTestId('comment-input')).toBeNull();
});

it('updates the post in the feed right away when you comment', async () => {
  await openFromFeed();
  await type('See everyone Saturday');
  await press(screen.getByTestId('comment-post'));
  await waitFor(() => expect(screen.getByTestId('comment-text-new-1')).toBeTruthy());
  await act(async () => router.back());
  await waitFor(() => expect(screen).toHavePathname('/home'));
  // Two comments were there, now three, with the new one previewed under the post.
  expect(screen.getByTestId('comment-count-p1')).toHaveTextContent('3');
  expect(screen.getByTestId('comments-p1')).toHaveTextContent('View all 3 comments');
  expect(screen.getByTestId('preview-comment-new-1')).toHaveTextContent(/See everyone Saturday$/);
  // The older top-level comment stays previewed; the reply isn't.
  expect(screen.getByTestId('preview-comment-c1')).toBeTruthy();
  expect(screen.queryByTestId('preview-comment-c2')).toBeNull();
});

it('corrects a stale count as soon as the comments open', async () => {
  // The post says 0 (counted before the server function ran) but has two comments.
  feed.resetFeedMock([feed.samplePost({ id: 'p1', caption: 'Sample gala photos' })]);
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('comment-p1')).toBeTruthy());
  expect(screen.queryByTestId('comment-count-p1')).toBeNull();
  await press(screen.getByTestId('comment-p1'));
  await waitFor(() => expect(screen.queryByText('Loading comments…')).toBeNull());
  await act(async () => router.back());
  await waitFor(() => expect(screen.getByTestId('comment-count-p1')).toHaveTextContent('2'));
});

it('posts a photo-only comment from the sheet', async () => {
  jest.mocked(pickCommentPhoto).mockResolvedValue({ status: 'picked', uri: 'file:///c.jpg' });
  await openFromFeed();
  expect(screen.getByTestId('comment-post').props.accessibilityState).toMatchObject({
    disabled: true,
  });
  await press(screen.getByTestId('comment-add-photo'));
  await waitFor(() => expect(screen.getByTestId('comment-photo-preview')).toBeTruthy());
  expect(screen.getByTestId('comment-post').props.accessibilityState).toMatchObject({
    disabled: false,
  });
  await press(screen.getByTestId('comment-post'));
  expect(comments.addComment).toHaveBeenCalledWith('p1', me(), '', null, 'file:///c.jpg');
  await waitFor(() => expect(screen.getByTestId('comment-photo-new-1')).toBeTruthy());
  expect(screen.queryByTestId('comment-photo-preview')).toBeNull();
});

it('lets you take the photo back off before posting', async () => {
  jest.mocked(pickCommentPhoto).mockResolvedValue({ status: 'picked', uri: 'file:///c.jpg' });
  await openFromFeed();
  await press(screen.getByTestId('comment-add-photo'));
  await waitFor(() => expect(screen.getByTestId('comment-photo-preview')).toBeTruthy());
  await press(screen.getByTestId('comment-photo-remove'));
  expect(screen.queryByTestId('comment-photo-preview')).toBeNull();
  expect(screen.getByTestId('comment-post').props.accessibilityState).toMatchObject({
    disabled: true,
  });
});
