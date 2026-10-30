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
const reports = jest.requireMock<typeof import('@/data/__mocks__/reports')>('@/data/reports');
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
const comments = jest.requireMock<typeof import('@/data/__mocks__/comments')>('@/data/comments');

const me = () => auth.sampleUser().uid;
const chris = {
  uid: 'sample-chris',
  displayName: 'Chris Baptiste',
  photoURL: null,
  headline: '',
  initiationTerm: '',
  role: null,
};

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  blocks.resetBlocksMock();
  reports.resetReportsMock();
  comments.resetCommentsMock();
  feed.resetFeedMock([
    feed.samplePost({ id: 'p1', authorId: 'sample-chris', author: chris }),
    feed.samplePost({ id: 'p2', authorId: 'sample-chris', author: chris }),
    feed.samplePost({ id: 'p3', authorId: 'sample-zed' }),
  ]);
  auth.setMockUser(auth.sampleUser());
});

describe('from a post', () => {
  async function openBlock() {
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen.getByTestId('post-p1')).toBeTruthy());
    await press(screen.getByTestId('post-menu-p1'));
    await press(screen.getByRole('button', { name: 'Block Chris Baptiste' }));
  }

  it('asks first, saying they won’t be told', async () => {
    await openBlock();
    expect(screen.getByText('Block Chris Baptiste?')).toBeTruthy();
    expect(
      screen.getByText(
        'They won’t be told. You won’t see their posts or comments. You can unblock them any time in Settings.',
      ),
    ).toBeTruthy();
    expect(blocks.block).not.toHaveBeenCalled();
  });

  it('blocks, and all of their posts leave the feed at once', async () => {
    await openBlock();
    await press(screen.getByTestId('block-confirm'));
    expect(blocks.block).toHaveBeenCalledWith(me(), 'sample-chris');
    await waitFor(() => expect(screen.queryByTestId('post-p1')).toBeNull());
    expect(screen.queryByTestId('post-p2')).toBeNull();
    expect(screen.getByTestId('post-p3')).toBeTruthy();
    expect(screen.getByTestId('reported-notice')).toHaveTextContent(/You blocked Chris Baptiste/);
  });

  it('cancel does nothing', async () => {
    await openBlock();
    await press(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(blocks.block).not.toHaveBeenCalled();
    expect(screen.getByTestId('post-p1')).toBeTruthy();
  });

  it('keeps the sheet open when blocking fails', async () => {
    blocks.block.mockRejectedValueOnce(new Error('offline'));
    await openBlock();
    await press(screen.getByTestId('block-confirm'));
    await waitFor(() => expect(screen.getByTestId('block-error')).toBeTruthy());
    expect(screen.getByTestId('post-p1')).toBeTruthy();
  });

  it('can’t block yourself', async () => {
    feed.resetFeedMock([feed.samplePost({ id: 'mine', authorId: me() })]);
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen.getByTestId('post-mine')).toBeTruthy());
    await press(screen.getByTestId('post-menu-mine'));
    expect(screen.queryByTestId('post-block')).toBeNull();
  });

  it('shows up in Settings to unblock', async () => {
    await openBlock();
    await press(screen.getByTestId('block-confirm'));
    await renderRouter('src/app', { initialUrl: '/profile/blocked' });
    await waitFor(() => expect(screen.getByTestId('unblock-sample-chris')).toBeTruthy());
  });
});

describe('from a comment', () => {
  it('blocks from the comment’s report sheet and hides their comments', async () => {
    comments.setMockComments('p3', [
      comments.sampleComment({ id: 'c1', text: 'One' }),
      comments.sampleComment({ id: 'c2', text: 'Two' }),
      comments.sampleComment({ id: 'c3', authorId: 'sample-zed', text: 'Three' }),
    ]);
    await renderRouter('src/app', { initialUrl: '/home/post/p3' });
    await waitFor(() => expect(screen.getByTestId('comment-c1')).toBeTruthy());
    await press(screen.getByTestId('comment-report-c1'));
    await press(screen.getByTestId('report-block'));
    expect(screen.getByText('Block Chris Baptiste?')).toBeTruthy();
    await press(screen.getByTestId('block-confirm'));
    expect(blocks.block).toHaveBeenCalledWith(me(), 'sample-chris');
    expect(reports.reportContent).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('comment-c1')).toBeNull());
    expect(screen.queryByTestId('comment-c2')).toBeNull();
    expect(screen.getByTestId('comment-c3')).toBeTruthy();
  });
});
