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
jest.mock('@/data/reports');
jest.mock('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
const feed = jest.requireMock<typeof import('@/data/__mocks__/feed')>('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
const posts = jest.requireMock<typeof import('@/data/__mocks__/posts')>('@/data/posts');
jest.mock('@/data/comments');
const comments = jest.requireMock<typeof import('@/data/__mocks__/comments')>('@/data/comments');

const me = () => auth.sampleUser().uid;
const mine = () =>
  feed.samplePost({ id: 'mine', authorId: me(), caption: 'My caption', allowComments: true });
const theirs = () =>
  feed.samplePost({ id: 'theirs', authorId: 'sample-chris', caption: 'Their caption' });

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  posts.resetPostsMock();
  comments.resetCommentsMock();
  feed.resetFeedMock([mine(), theirs()]);
  auth.setMockUser(auth.sampleUser());
});

async function openHome() {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('post-mine')).toBeTruthy());
}

describe('my posts', () => {
  it('only my posts get the edit and delete menu', async () => {
    await openHome();
    expect(screen.getByTestId('post-menu-mine')).toBeTruthy();
    expect(screen.queryByTestId('post-menu-theirs')).toBeNull();
  });

  it('edits the caption and comment setting', async () => {
    await openHome();
    await press(screen.getByTestId('post-menu-mine'));
    await press(screen.getByTestId('post-edit'));
    expect(screen.getByTestId('post-edit-caption').props.value).toBe('My caption');
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('post-edit-caption'), '  Fixed caption ');
      fireEvent(screen.getByTestId('post-edit-comments'), 'valueChange', false);
    });
    await press(screen.getByTestId('post-edit-save'));
    expect(posts.updatePost).toHaveBeenCalledWith('mine', {
      caption: 'Fixed caption',
      allowComments: false,
    });
    await waitFor(() =>
      expect(screen.getByTestId('caption-mine')).toHaveTextContent(/Fixed caption$/),
    );
    expect(screen.queryByTestId('comment-mine')).toBeNull();
  });

  it('won’t save a text-only post with an empty caption', async () => {
    await openHome();
    await press(screen.getByTestId('post-menu-mine'));
    await press(screen.getByTestId('post-edit'));
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('post-edit-caption'), '  ');
    });
    expect(screen.getByText('A post without photos needs a caption.')).toBeTruthy();
    expect(screen.getByTestId('post-edit-save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('keeps the edit open and says so when saving fails', async () => {
    posts.updatePost.mockRejectedValueOnce(new Error('offline'));
    await openHome();
    await press(screen.getByTestId('post-menu-mine'));
    await press(screen.getByTestId('post-edit'));
    await press(screen.getByTestId('post-edit-save'));
    await waitFor(() =>
      expect(screen.getByText('Couldn’t save your changes. Try again.')).toBeTruthy(),
    );
  });

  it('deletes only after confirming, and it leaves the feed', async () => {
    await openHome();
    await press(screen.getByTestId('post-menu-mine'));
    await press(screen.getByTestId('post-delete'));
    expect(
      screen.getByText('Its photos, comments and likes go too. This can’t be undone.'),
    ).toBeTruthy();
    expect(posts.deletePost).not.toHaveBeenCalled();
    await press(screen.getByTestId('post-delete-confirm'));
    expect(posts.deletePost).toHaveBeenCalledWith('mine');
    await waitFor(() => expect(screen.queryByTestId('post-mine')).toBeNull());
    expect(screen.getByTestId('post-theirs')).toBeTruthy();
  });

  it('deleting from the post’s own screen goes back to a refreshed feed', async () => {
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen.getByTestId('post-mine')).toBeTruthy());
    await press(screen.getByTestId('comment-mine'));
    await waitFor(() => expect(screen.getByTestId('comment-count')).toBeTruthy());
    feed.setMockPosts([theirs()]);
    await press(screen.getByTestId('post-menu-mine'));
    await press(screen.getByTestId('post-delete'));
    await press(screen.getByTestId('post-delete-confirm'));
    await waitFor(() => expect(screen).toHavePathname('/home'));
    await waitFor(() => expect(screen.queryByTestId('post-mine')).toBeNull());
  });
});

describe('my comments', () => {
  beforeEach(() => {
    comments.setMockComments('theirs', [
      comments.sampleComment({ id: 'c1', authorId: me(), text: 'My comment' }),
      comments.sampleComment({ id: 'c2', text: 'Someone else' }),
    ]);
  });

  async function openPost() {
    await renderRouter('src/app', { initialUrl: '/home/post/theirs' });
    await waitFor(() => expect(screen.getByTestId('comment-c1')).toBeTruthy());
  }

  it('only my comments can be deleted by me', async () => {
    await openPost();
    expect(screen.getByTestId('comment-delete-c1')).toBeTruthy();
    expect(screen.queryByTestId('comment-delete-c2')).toBeNull();
  });

  it('deletes my comment after confirming', async () => {
    await openPost();
    await press(screen.getByTestId('comment-delete-c1'));
    expect(screen.getByText('Delete this comment?')).toBeTruthy();
    await press(screen.getByTestId('comment-delete-confirm'));
    expect(comments.deleteComment).toHaveBeenCalledWith('theirs', 'c1');
    await waitFor(() => expect(screen.queryByTestId('comment-c1')).toBeNull());
    expect(screen.getByTestId('comment-count')).toHaveTextContent('1 comment');
  });

  it('keeps it and says so when deleting fails', async () => {
    comments.deleteComment.mockRejectedValueOnce(new Error('offline'));
    await openPost();
    await press(screen.getByTestId('comment-delete-c1'));
    await press(screen.getByTestId('comment-delete-confirm'));
    await waitFor(() => expect(screen.getByText('Couldn’t delete it. Try again.')).toBeTruthy());
    expect(screen.getByTestId('comment-c1')).toBeTruthy();
  });
});
