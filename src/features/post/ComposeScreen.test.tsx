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
const directory = jest.requireMock<typeof import('@/data/__mocks__/directory')>('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
const events = jest.requireMock<typeof import('@/data/__mocks__/events')>('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
const feed = jest.requireMock<typeof import('@/data/__mocks__/feed')>('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
const posts = jest.requireMock<typeof import('@/data/__mocks__/posts')>('@/data/posts');
jest.mock('./pickPhotos', () => ({ pickFromLibrary: jest.fn(), takePhoto: jest.fn() }));
const picker = jest.requireMock<typeof import('./pickPhotos')>('./pickPhotos');

const photos = (...ns: number[]) =>
  ns.map((n) => ({ uri: `file:///${n}.jpg`, width: 1000, height: 1000 }));
const me = () => auth.sampleUser().uid;

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

async function type(testID: string, text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), text);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  posts.resetPostsMock();
  feed.resetFeedMock([]);
  events.resetEventsMock([
    events.sampleEvent({
      id: 'gala',
      title: 'Sample gala',
      startsAt: new Date(Date.now() - 86_400_000),
    }),
    events.sampleEvent({
      id: 'meeting',
      title: 'Sample meeting',
      startsAt: new Date(Date.now() + 5 * 86_400_000),
    }),
  ]);
  directory.resetDirectoryMock([
    directory.sampleEntry({ uid: 'b', displayName: 'Chris Baptiste' }),
    directory.sampleEntry({ uid: 'z', displayName: 'Zed Allen' }),
    directory.sampleEntry({ uid: me(), displayName: 'Me' }),
  ]);
  auth.setMockUser(auth.sampleUser());
});

/** Opens the flow from Home, picks photos and goes to compose. */
async function compose(...ns: number[]) {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('tab-post')).toBeTruthy());
  await press(screen.getByTestId('tab-post'));
  await waitFor(() => expect(screen.getByTestId('post-choose')).toBeTruthy());
  if (ns.length) {
    jest
      .mocked(picker.pickFromLibrary)
      .mockResolvedValue({ status: 'picked', photos: photos(...ns) });
    await press(screen.getByTestId('post-choose'));
    await press(screen.getByTestId('post-next'));
  } else {
    await press(screen.getByTestId('post-text-only'));
  }
  await waitFor(() => expect(screen.getByTestId('compose-caption')).toBeTruthy());
}

it('shares photos, caption, event, tags and the comments setting, cover first', async () => {
  await compose(1, 2, 3);
  await press(screen.getByTestId('compose-photo-3'));
  expect(screen.getByTestId('compose-photo-1').props.accessibilityLabel).toBe('Photo 1, cover');
  await type('compose-caption', '  Great turnout at the gala ');

  await press(screen.getByTestId('compose-tag-event'));
  await waitFor(() => expect(screen.getByTestId('tag-event-gala')).toBeTruthy());
  await press(screen.getByTestId('tag-event-gala'));

  await press(screen.getByTestId('compose-tag-brothers'));
  await waitFor(() => expect(screen.getByTestId('tag-brother-b')).toBeTruthy());
  expect(screen.queryByTestId(`tag-brother-${me()}`)).toBeNull();
  await press(screen.getByTestId('tag-brother-b'));
  await press(screen.getByTestId('tag-brother-z'));
  await press(screen.getByTestId('tag-done'));
  expect(screen.getByText('Chris Baptiste and Zed Allen')).toBeTruthy();

  await act(async () => {
    fireEvent(screen.getByTestId('compose-comments'), 'valueChange', false);
  });
  await press(screen.getByTestId('compose-share'));

  expect(posts.uploadPostPhoto.mock.calls.map((c) => [c[2], c[3]])).toEqual([
    [0, 'file:///3.jpg'],
    [1, 'file:///1.jpg'],
    [2, 'file:///2.jpg'],
  ]);
  expect(posts.createPost).toHaveBeenCalledWith('new-post', me(), {
    caption: 'Great turnout at the gala',
    photoPaths: [
      `posts/${me()}/new-post/0.jpg`,
      `posts/${me()}/new-post/1.jpg`,
      `posts/${me()}/new-post/2.jpg`,
    ],
    eventId: 'gala',
    taggedMemberIds: ['b', 'z'],
    allowComments: false,
  });
  await waitFor(() => expect(screen.getByTestId('posted')).toBeTruthy());
});

it('a text-only post needs words before Share turns on', async () => {
  await compose();
  expect(screen.getByTestId('compose-share').props.accessibilityState).toMatchObject({
    disabled: true,
  });
  await type('compose-caption', 'Chapter meeting moved to 7.');
  expect(screen.getByTestId('compose-share').props.accessibilityState).toMatchObject({
    disabled: false,
  });
  await press(screen.getByTestId('compose-share'));
  expect(posts.uploadPostPhoto).not.toHaveBeenCalled();
  expect(posts.createPost).toHaveBeenCalledWith(
    'new-post',
    me(),
    expect.objectContaining({ photoPaths: [], caption: 'Chapter meeting moved to 7.' }),
  );
});

it('says posts are for approved members only, and links the guidelines', async () => {
  await compose(1);
  expect(screen.getByText('Only approved Sigma Sigma Lambda members can see posts.')).toBeTruthy();
  await press(screen.getByTestId('compose-guidelines'));
  await waitFor(() => expect(screen).toHavePathname('/guidelines'));
});

it('keeps everything and says so when sharing fails', async () => {
  posts.createPost.mockRejectedValueOnce(new Error('offline'));
  await compose(1);
  await type('compose-caption', 'Keep me');
  await press(screen.getByTestId('compose-share'));
  await waitFor(() => expect(screen.getByTestId('compose-error')).toBeTruthy());
  expect(screen.getByTestId('compose-caption').props.value).toBe('Keep me');
  expect(screen.queryByTestId('posted')).toBeNull();
});

it('Posted links back to the feed, which reloads with the new post', async () => {
  await compose(1);
  feed.setMockPosts([feed.samplePost({ id: 'new-post', caption: 'Just shared' })]);
  await press(screen.getByTestId('compose-share'));
  await waitFor(() => expect(screen.getByTestId('posted-feed')).toBeTruthy());
  await press(screen.getByTestId('posted-feed'));
  await waitFor(() => expect(screen).toHavePathname('/home'));
  await waitFor(() => expect(screen.getByTestId('post-new-post')).toBeTruthy());
});

it('Posted links to the new post', async () => {
  await compose(1);
  await press(screen.getByTestId('compose-share'));
  await waitFor(() => expect(screen.getByTestId('posted-view')).toBeTruthy());
  await press(screen.getByTestId('posted-view'));
  await waitFor(() => expect(screen).toHavePathname('/home/post/new-post'));
});

it('Back returns to the photos with the picks kept', async () => {
  await compose(1, 2);
  await press(screen.getByTestId('compose-back'));
  await waitFor(() => expect(screen.getByTestId('thumb-2')).toBeTruthy());
});
