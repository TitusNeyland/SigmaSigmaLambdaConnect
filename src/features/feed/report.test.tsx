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
const theirs = (id: string) =>
  feed.samplePost({ id, authorId: 'sample-chris', caption: `Post ${id}` });

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  reports.resetReportsMock();
  comments.resetCommentsMock();
  feed.resetFeedMock([theirs('p1'), theirs('p2')]);
  auth.setMockUser(auth.sampleUser());
});

describe('reporting a post', () => {
  async function openReport() {
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen.getByTestId('post-p1')).toBeTruthy());
    await press(screen.getByTestId('post-menu-p1'));
    await press(screen.getByTestId('post-report'));
  }

  it('offers the four reasons and says only officers see reports', async () => {
    await openReport();
    for (const label of ['Spam', 'Harassment or bullying', 'Inappropriate', 'Something else']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(
      screen.getByText('Why are you reporting this post? Only chapter officers see reports.'),
    ).toBeTruthy();
  });

  it('sends it to the officers’ queue and hides it for me', async () => {
    await openReport();
    await press(screen.getByRole('button', { name: 'Inappropriate' }));
    expect(reports.reportContent).toHaveBeenCalledWith(me(), {
      targetType: 'post',
      postId: 'p1',
      targetAuthorId: 'sample-chris',
      reason: 'inappropriate',
    });
    await waitFor(() => expect(screen.getByTestId('reported-notice')).toBeTruthy());
    expect(screen.getByTestId('reported-notice')).toHaveTextContent(/won’t see this post/);
    expect(screen.queryByTestId('post-p1')).toBeNull();
    expect(screen.getByTestId('post-p2')).toBeTruthy();
  });

  it('keeps the sheet open and the post shown when reporting fails', async () => {
    reports.reportContent.mockRejectedValueOnce(new Error('offline'));
    await openReport();
    await press(screen.getByRole('button', { name: 'Spam' }));
    await waitFor(() => expect(screen.getByTestId('report-error')).toBeTruthy());
    expect(screen.getByTestId('post-p1')).toBeTruthy();
  });

  it('stays hidden when opened by link', async () => {
    reports.setMockHidden(['post_p1']);
    await renderRouter('src/app', { initialUrl: '/home/post/p1' });
    await waitFor(() =>
      expect(
        screen.getByText('You won’t see this post. You reported it or blocked its author.'),
      ).toBeTruthy(),
    );
  });

  it('my own posts can’t be reported', async () => {
    feed.resetFeedMock([feed.samplePost({ id: 'mine', authorId: me() })]);
    await renderRouter('src/app', { initialUrl: '/home' });
    await waitFor(() => expect(screen.getByTestId('post-mine')).toBeTruthy());
    await press(screen.getByTestId('post-menu-mine'));
    expect(screen.queryByTestId('post-report')).toBeNull();
  });
});

describe('reporting a comment', () => {
  beforeEach(() => {
    comments.setMockComments('p1', [
      comments.sampleComment({ id: 'c1', text: 'Rude comment' }),
      comments.sampleComment({ id: 'c2', authorId: me(), text: 'Mine' }),
      comments.sampleComment({ id: 'c3', text: 'Fine comment' }),
    ]);
  });

  async function openPost() {
    await renderRouter('src/app', { initialUrl: '/home/post/p1' });
    await waitFor(() => expect(screen.getByTestId('comment-c1')).toBeTruthy());
  }

  it('reports someone else’s comment and hides only that one for me', async () => {
    await openPost();
    expect(screen.queryByTestId('comment-report-c2')).toBeNull();
    await press(screen.getByTestId('comment-report-c1'));
    await press(screen.getByRole('button', { name: 'Harassment or bullying' }));
    expect(reports.reportContent).toHaveBeenCalledWith(me(), {
      targetType: 'comment',
      postId: 'p1',
      commentId: 'c1',
      targetAuthorId: 'sample-chris',
      reason: 'harassment',
    });
    await waitFor(() => expect(screen.queryByTestId('comment-c1')).toBeNull());
    expect(screen.getByTestId('comment-c3')).toBeTruthy();
    expect(screen.getByTestId('reported-notice')).toHaveTextContent(/won’t see this comment/);
    await press(screen.getByTestId('reported-notice'));
    expect(screen.queryByTestId('reported-notice')).toBeNull();
  });
});
