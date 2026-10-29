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
const likes = jest.requireMock<typeof import('@/data/__mocks__/likes')>('@/data/likes');

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  likes.resetLikesMock();
  auth.setMockUser(auth.sampleUser());
});

async function openHome(post: Parameters<typeof feed.samplePost>[0]) {
  feed.resetFeedMock([feed.samplePost({ id: 'p1', ...post })]);
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('like-p1')).toBeTruthy());
}

const likeButton = () => screen.getByTestId('like-p1');
const count = () => screen.queryByTestId('likes-p1')?.props.children ?? null;

it('likes in one tap with the count updated at once', async () => {
  await openHome({ likeCount: 4 });
  expect(likeButton().props.accessibilityLabel).toBe('Like');
  await press(likeButton());
  expect(likes.likePost).toHaveBeenCalledWith('p1', auth.sampleUser().uid);
  expect(likeButton().props.accessibilityLabel).toBe('Unlike');
  expect(likeButton().props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId('likes-p1')).toHaveTextContent('5 likes');
});

it('unlikes a post I already liked', async () => {
  await openHome({ likeCount: 1, likedByMe: true });
  await press(likeButton());
  expect(likes.unlikePost).toHaveBeenCalledWith('p1', auth.sampleUser().uid);
  expect(count()).toBeNull();
});

it('shows the first like as "1 like"', async () => {
  await openHome({ likeCount: 0 });
  await press(likeButton());
  expect(screen.getByTestId('likes-p1')).toHaveTextContent('1 like');
});

it('puts it back and says so when saving fails', async () => {
  likes.likePost.mockRejectedValueOnce(new Error('offline'));
  await openHome({ likeCount: 4 });
  await press(likeButton());
  await waitFor(() => expect(screen.getByTestId('like-error-p1')).toBeTruthy());
  expect(likeButton().props.accessibilityLabel).toBe('Like');
  expect(screen.getByTestId('likes-p1')).toHaveTextContent('4 likes');
});

it('ignores a second tap while the first is saving', async () => {
  let finish: () => void = () => {};
  likes.likePost.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
  await openHome({ likeCount: 0 });
  await act(async () => {
    fireEvent.press(likeButton());
    fireEvent.press(likeButton());
  });
  expect(likes.likePost).toHaveBeenCalledTimes(1);
  expect(likes.unlikePost).not.toHaveBeenCalled();
  await act(async () => finish());
});

it('double-tapping a photo likes it, and never unlikes', async () => {
  await openHome({ likeCount: 2, photoPaths: ['posts/a/p1/0.jpg'] });
  const photo = screen.getByTestId('photo-tap-posts/a/p1/0.jpg');
  await act(async () => {
    fireEvent.press(photo);
    fireEvent.press(photo);
  });
  expect(likes.likePost).toHaveBeenCalledTimes(1);
  await act(async () => {
    fireEvent.press(photo);
    fireEvent.press(photo);
  });
  expect(likes.unlikePost).not.toHaveBeenCalled();
  expect(screen.getByTestId('likes-p1')).toHaveTextContent('3 likes');
});

it('a single tap on a photo does nothing', async () => {
  await openHome({ photoPaths: ['posts/a/p1/0.jpg'] });
  await press(screen.getByTestId('photo-tap-posts/a/p1/0.jpg'));
  expect(likes.likePost).not.toHaveBeenCalled();
});

it('the comment button opens the post, and is hidden when comments are off', async () => {
  await openHome({});
  await press(screen.getByTestId('comment-p1'));
  await waitFor(() => expect(screen).toHavePathname('/home/post/p1'));
});

it('hides the comment button when comments are off', async () => {
  await openHome({ allowComments: false });
  expect(screen.queryByTestId('comment-p1')).toBeNull();
});
