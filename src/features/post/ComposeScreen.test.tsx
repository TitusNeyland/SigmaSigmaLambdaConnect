import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

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
jest.mock('@/data/comments');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
const mod = jest.requireMock<typeof import('@/data/__mocks__/moderation')>('@/data/moderation');
const posts = jest.requireMock<typeof import('@/data/__mocks__/posts')>('@/data/posts');
jest.mock('./preparePhoto', () => ({
  preparePhoto: jest.fn(async (photo: { uri: string }) => photo.uri.replace('.jpg', '-small.jpg')),
}));
const { preparePhoto } = jest.requireMock<typeof import('./preparePhoto')>('./preparePhoto');
jest.mock('./pickPhotos', () => ({ pickFromLibrary: jest.fn(), takePhoto: jest.fn() }));
const picker = jest.requireMock<typeof import('./pickPhotos')>('./pickPhotos');

const photos = (...ns: number[]) =>
  ns.map((n) => ({ uri: `file:///${n}.jpg`, width: 1000, height: 1000 }));

// The camera roll mock (jest.setup.js): photo "n" resolves to file:///n.jpg.
const roll = jest.requireMock<{
  __setPhotos: (
    photos: { id: string; width: number; height: number; favorite?: boolean; albumId?: string }[],
  ) => void;
  __setAlbums: (albums: { id: string; title: string; type: string | null }[]) => void;
  __setPermission: (permission: object) => void;
  presentPermissionsPicker: jest.Mock;
}>('expo-media-library');
const rollPhotos = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: String(i + 1), width: 1000, height: 1000 }));
const access = (granted: boolean, extra: object = {}) => ({
  granted,
  canAskAgain: true,
  accessPrivileges: granted ? 'all' : 'none',
  status: granted ? 'granted' : 'undetermined',
  ...extra,
});
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
  mod.resetModerationMock();
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
  roll.__setPhotos(rollPhotos(12));
  roll.__setPermission(access(true));
  roll.__setAlbums([]);
  auth.setMockUser(auth.sampleUser());
});

/** Opens the Post tab, which goes straight to picking photos, and taps photos in the camera roll. */
async function compose(...ns: number[]) {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('tab-post')).toBeTruthy());
  await press(screen.getByTestId('tab-post'));
  await waitFor(() => expect(screen.getByTestId('pick-next')).toBeTruthy());
  if (screen.queryByTestId('camera-roll')) {
    await waitFor(() => expect(screen.getByTestId('roll-1')).toBeTruthy());
  }
  for (const [i, n] of ns.entries()) {
    await press(screen.getByTestId(`roll-${n}`));
    await waitFor(() => expect(screen.getByTestId(`pick-photo-${i + 1}`)).toBeTruthy());
  }
}

/** Next from the editor, after opening it from the photos with Next if it isn't open yet. */
async function editorNext() {
  if (!screen.queryByTestId('editor-next')) {
    await press(screen.getByTestId('pick-next'));
    await waitFor(() => expect(screen.getByTestId('editor-next')).toBeTruthy());
  }
  await press(screen.getByTestId('editor-next'));
  await waitFor(() => expect(screen.getByTestId('compose-caption')).toBeTruthy());
}

/** Goes on to the caption step: through the editor with photos, straight there without. */
async function toCaption() {
  if (screen.queryByTestId('pick-photo-1') || screen.queryByTestId('editor-next')) {
    return editorNext();
  }
  await press(screen.getByTestId('pick-next'));
  await waitFor(() => expect(screen.getByTestId('compose-caption')).toBeTruthy());
}

it('shares photos, caption, event, tags and the comments setting, cover first', async () => {
  await compose(1, 2, 3);
  // Tapping a photo opens the editor, which can make it the cover.
  await press(screen.getByTestId('pick-photo-3'));
  await waitFor(() => expect(screen.getByTestId('editor-make-cover')).toBeTruthy());
  await press(screen.getByTestId('editor-make-cover'));
  await editorNext();
  expect(screen.getByTestId('compose-photos').props.accessibilityLabel).toBe(
    '3 photos, cover first',
  );
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

  // Each photo is shrunk before upload, cover first.
  expect(posts.uploadPostPhoto.mock.calls.map((c) => [c[2], c[3]])).toEqual([
    [0, 'file:///3-small.jpg'],
    [1, 'file:///1-small.jpg'],
    [2, 'file:///2-small.jpg'],
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
    official: false,
    // The roll photos are square, and Original follows the cover.
    aspectRatio: 1,
  });
  await waitFor(() => expect(screen.getByTestId('posted')).toBeTruthy());
});

it('a text-only post skips the editor, and needs words before Share turns on', async () => {
  await compose();
  await toCaption();
  expect(screen.queryByTestId('editor-frame')).toBeNull();
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
  await toCaption();
  expect(screen.getByText('Only approved Sigma Sigma Lambda members can see posts.')).toBeTruthy();
  await press(screen.getByTestId('compose-guidelines'));
  await waitFor(() => expect(screen).toHavePathname('/guidelines'));
});

it('keeps everything and says so when sharing fails', async () => {
  posts.createPost.mockRejectedValueOnce(new Error('offline'));
  await compose(1);
  await toCaption();
  await type('compose-caption', 'Keep me');
  await press(screen.getByTestId('compose-share'));
  await waitFor(() => expect(screen.getByTestId('compose-error')).toBeTruthy());
  expect(screen.getByTestId('compose-caption').props.value).toBe('Keep me');
  expect(screen.queryByTestId('posted')).toBeNull();
});

it('Posted links back to the feed, which reloads with the new post', async () => {
  await compose(1);
  await toCaption();
  feed.setMockPosts([feed.samplePost({ id: 'new-post', caption: 'Just shared' })]);
  await press(screen.getByTestId('compose-share'));
  await waitFor(() => expect(screen.getByTestId('posted-feed')).toBeTruthy());
  await press(screen.getByTestId('posted-feed'));
  await waitFor(() => expect(screen).toHavePathname('/home'));
  await waitFor(() => expect(screen.getByTestId('post-new-post')).toBeTruthy());
});

it('Posted links to the new post', async () => {
  await compose(1);
  await toCaption();
  await press(screen.getByTestId('compose-share'));
  await waitFor(() => expect(screen.getByTestId('posted-view')).toBeTruthy());
  await press(screen.getByTestId('posted-view'));
  await waitFor(() => expect(screen).toHavePathname('/home/post/new-post'));
});

describe('photos', () => {
  it('the Post tab opens straight to the camera roll', async () => {
    await compose();
    expect(screen.getByRole('header', { name: 'New post' })).toBeTruthy();
    expect(screen.getByText('Recents')).toBeTruthy();
    expect(screen.getByTestId('roll-camera')).toBeTruthy();
    expect(screen.getByTestId('roll-12')).toBeTruthy();
    expect(screen.queryByTestId('pick-photo-1')).toBeNull();
    expect(screen.queryByTestId('compose-caption')).toBeNull();
  });

  it('with photos picked, Next opens the editor, and its Next goes on to the caption', async () => {
    await compose(1, 2);
    expect(screen.getByTestId('pick-next')).toHaveTextContent('Next');
    expect(screen.queryByTestId('compose-share')).toBeNull();
    await press(screen.getByTestId('pick-next'));
    await waitFor(() => expect(screen).toHavePathname('/new-post/edit'));
    expect(screen.getByRole('header', { name: 'Edit photos' })).toBeTruthy();
    expect(screen.getByTestId('editor-next')).toHaveTextContent('Next');
    // Starts on the cover.
    expect(screen.getByTestId('editor-is-cover')).toBeTruthy();
    await editorNext();
    expect(screen).toHavePathname('/new-post/details');
    expect(screen.getByTestId('compose-share')).toHaveTextContent('Share');
    expect(screen.getByTestId('compose-photo-2')).toBeTruthy();
  });

  it('Back from the caption keeps what was written', async () => {
    await compose(1);
    await toCaption();
    await type('compose-caption', 'Still here');
    await act(async () => {
      fireEvent(screen.getByTestId('compose-comments'), 'valueChange', false);
    });
    await press(screen.getByTestId('compose-back'));
    await waitFor(() => expect(screen).toHavePathname('/new-post/edit'));
    await editorNext();
    expect(screen.getByTestId('compose-caption').props.value).toBe('Still here');
    expect(screen.getByTestId('compose-comments').props.value).toBe(false);
  });

  it('puts the guidelines under the caption, then tags, then who can see posts', async () => {
    await compose();
    await toCaption();
    // Every testID in the order it renders, top to bottom.
    type Node = { props?: { testID?: unknown }; children?: unknown[] | null };
    const order: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const { props, children } = node as Node;
      if (typeof props?.testID === 'string') order.push(props.testID);
      children?.forEach(walk);
    };
    walk(screen.toJSON());
    const at = (id: string) => order.indexOf(id);
    expect(at('compose-caption')).toBeLessThan(at('compose-guidelines'));
    expect(at('compose-guidelines')).toBeLessThan(at('compose-tag-event'));
    expect(at('compose-tag-event')).toBeLessThan(at('compose-comments'));
  });

  it('picks from the camera roll in order, and tapping again unpicks', async () => {
    await compose(3, 1);
    expect(screen.getByTestId('roll-3').props.accessibilityLabel).toBe('Photo, picked 1');
    expect(screen.getByTestId('roll-1').props.accessibilityLabel).toBe('Photo, picked 2');
    await press(screen.getByTestId('roll-3'));
    expect(screen.getByTestId('roll-3').props.accessibilityLabel).toBe('Photo');
    expect(screen.getByTestId('roll-1').props.accessibilityLabel).toBe('Photo, picked 1');
    expect(screen.queryByTestId('pick-photo-2')).toBeNull();
  });

  it('stops at 10 photos', async () => {
    await compose(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    expect(screen.getByTestId('roll-11').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await press(screen.getByTestId('roll-11'));
    expect(screen.queryByTestId('pick-photo-11')).toBeNull();
  });

  it('removing from the strip unpicks it in the camera roll too', async () => {
    await compose(1, 2);
    await press(screen.getByTestId('pick-remove-1'));
    expect(screen.getByTestId('roll-1').props.accessibilityLabel).toBe('Photo');
    expect(screen.getByTestId('pick-photo-1').props.accessibilityLabel).toBe('Photo 1, cover');
  });

  it('the camera tile takes a photo, and explains when the camera is off', async () => {
    await compose();
    jest.mocked(picker.takePhoto).mockResolvedValueOnce({ status: 'denied' });
    await press(screen.getByTestId('roll-camera'));
    expect(screen.getByTestId('pick-photo-note')).toHaveTextContent(
      'Allow camera access in Settings to take a photo.',
    );
    jest.mocked(picker.takePhoto).mockResolvedValueOnce({ status: 'picked', photos: photos(77) });
    await press(screen.getByTestId('roll-camera'));
    await waitFor(() => expect(screen.getByTestId('pick-photo-1')).toBeTruthy());
    expect(screen.queryByTestId('pick-photo-note')).toBeNull();
  });

  it('loads more of the camera roll on request', async () => {
    roll.__setPhotos(rollPhotos(70));
    await compose();
    expect(screen.queryByTestId('roll-61')).toBeNull();
    await press(screen.getByTestId('roll-more'));
    await waitFor(() => expect(screen.getByTestId('roll-70')).toBeTruthy());
    expect(screen.queryByTestId('roll-more')).toBeNull();
  });

  describe('choosing which photos to show', () => {
    beforeEach(() => {
      roll.__setPhotos([
        { id: '1', width: 1000, height: 1000, favorite: true },
        { id: '2', width: 1000, height: 1000, albumId: 'trip' },
        { id: '3', width: 1000, height: 1000, favorite: true, albumId: 'trip' },
        { id: '4', width: 1000, height: 1000 },
      ]);
      roll.__setAlbums([
        { id: 'trip', title: 'Spring trip', type: 'album' },
        { id: 'shots', title: 'Screenshots', type: 'smartAlbum' },
        { id: 'chapter', title: 'Chapter', type: null },
      ]);
    });

    const shown = () =>
      ['1', '2', '3', '4'].filter((id) => screen.queryByTestId(`roll-${id}`) !== null);

    it('starts on Recents and switches to Favorites', async () => {
      await compose();
      expect(screen.getByTestId('roll-source')).toHaveTextContent('Recents');
      expect(shown()).toEqual(['1', '2', '3', '4']);
      await press(screen.getByTestId('roll-source'));
      await press(screen.getByTestId('roll-show-favorites'));
      await waitFor(() => expect(shown()).toEqual(['1', '3']));
      expect(screen.getByTestId('roll-source')).toHaveTextContent('Favorites');
    });

    it('lists the member’s own albums by name, and shows one', async () => {
      await compose();
      await press(screen.getByTestId('roll-source'));
      await press(screen.getByTestId('roll-show-albums'));
      await waitFor(() => expect(screen.getByTestId('roll-album-trip')).toBeTruthy());
      // Smart albums like Screenshots aren't listed; the rest are by name.
      expect(screen.queryByTestId('roll-album-shots')).toBeNull();
      expect(screen.getByTestId('roll-album-chapter')).toBeTruthy();
      await press(screen.getByTestId('roll-album-trip'));
      await waitFor(() => expect(shown()).toEqual(['2', '3']));
      expect(screen.getByTestId('roll-source')).toHaveTextContent('Spring trip');
      // And back to everything.
      await press(screen.getByTestId('roll-source'));
      await press(screen.getByTestId('roll-show-recents'));
      await waitFor(() => expect(shown()).toEqual(['1', '2', '3', '4']));
    });

    it('keeps picks when switching, and says when there’s nothing to show', async () => {
      roll.__setPhotos([{ id: '1', width: 1000, height: 1000 }]);
      await compose(1);
      await press(screen.getByTestId('roll-source'));
      await press(screen.getByTestId('roll-show-favorites'));
      await waitFor(() =>
        expect(screen.getByTestId('roll-empty')).toHaveTextContent('No favorite photos yet.'),
      );
      expect(screen.getByTestId('pick-photo-1')).toBeTruthy();
    });
  });

  it('with only some photos shared, offers to select more', async () => {
    roll.__setPermission({ ...access(true), accessPrivileges: 'limited' });
    await compose();
    await press(screen.getByTestId('roll-select-more'));
    expect(roll.presentPermissionsPicker).toHaveBeenCalled();
  });

  it('without access, asks for it, and the system picker still works', async () => {
    roll.__setPermission(access(false));
    await compose();
    expect(screen.queryByTestId('camera-roll')).toBeNull();
    expect(screen.getByTestId('roll-allow')).toBeTruthy();
    jest.mocked(picker.pickFromLibrary).mockResolvedValueOnce({ status: 'canceled' });
    await press(screen.getByTestId('roll-library'));
    expect(picker.pickFromLibrary).toHaveBeenLastCalledWith(10);
    expect(screen.queryByTestId('pick-photo-1')).toBeNull();
    jest
      .mocked(picker.pickFromLibrary)
      .mockResolvedValueOnce({ status: 'picked', photos: photos(5, 6) });
    await press(screen.getByTestId('roll-library'));
    await waitFor(() => expect(screen.getByTestId('pick-photo-2')).toBeTruthy());
    // Granting access shows the camera roll.
    roll.__setPermission(access(true));
    await press(screen.getByTestId('roll-allow'));
    await waitFor(() => expect(screen.getByTestId('camera-roll')).toBeTruthy());
  });

  it('when access was turned off, points to Settings', async () => {
    roll.__setPermission({ ...access(false), canAskAgain: false, status: 'denied' });
    await compose();
    expect(screen.getByTestId('roll-settings')).toBeTruthy();
    expect(screen.queryByTestId('roll-allow')).toBeNull();
  });

  describe('framing photos', () => {
    beforeEach(() => {
      roll.__setPhotos([
        { id: '1', width: 1920, height: 1080 },
        { id: '2', width: 1080, height: 1920 },
      ]);
    });

    async function share() {
      if (!screen.queryByTestId('compose-share')) await toCaption();
      await press(screen.getByTestId('compose-share'));
      await waitFor(() => expect(posts.createPost).toHaveBeenCalled());
      return jest.mocked(posts.createPost).mock.calls[0][2];
    }

    it('a wide photo posts wide, so the feed shows all of it', async () => {
      await compose(1);
      await toCaption();
      // And the caption step shows it wide too.
      const thumb = StyleSheet.flatten(screen.getByTestId('compose-photo-1').props.style);
      expect(thumb.width / thumb.height).toBeCloseTo(16 / 9, 1);
      expect((await share()).aspectRatio).toBeCloseTo(16 / 9);
      // Uploaded at that shape, uncut.
      expect(preparePhoto).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'file:///1.jpg' }),
        expect.closeTo(16 / 9, 6),
      );
    });

    it('a tall photo posts at 4:5, the tallest the feed shows', async () => {
      await compose(2);
      expect((await share()).aspectRatio).toBe(0.8);
    });

    it('the editor sets the post’s shape for every photo', async () => {
      await compose(1, 2);
      await press(screen.getByTestId('pick-photo-2'));
      await waitFor(() => expect(screen.getByTestId('editor-frame')).toBeTruthy());
      // The frame is the screen's width at the post's shape (Original: the 16:9 cover).
      const frame = () => StyleSheet.flatten(screen.getByTestId('editor-frame').props.style);
      expect(frame().height).toBe(Math.round(frame().width / (16 / 9)));
      await act(async () => {
        fireEvent.press(screen.getByTestId('editor-shape-square'));
      });
      expect(frame().height).toBe(frame().width);
      await editorNext();
      expect((await share()).aspectRatio).toBe(1);
      expect(preparePhoto).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'file:///2.jpg' }),
        1,
      );
    });

    it('Back from the editor returns to the photos and keeps the shape', async () => {
      await compose(1);
      await press(screen.getByTestId('pick-photo-1'));
      await waitFor(() => expect(screen.getByTestId('editor-is-cover')).toBeTruthy());
      await act(async () => {
        fireEvent.press(screen.getByTestId('editor-shape-portrait'));
      });
      await press(screen.getByTestId('editor-back'));
      await waitFor(() => expect(screen).toHavePathname('/new-post'));
      expect((await share()).aspectRatio).toBe(0.8);
    });

    /** The crop each photo went up with, by uri. */
    const cropsSent = () =>
      Object.fromEntries(
        (
          jest.mocked(preparePhoto).mock.calls as unknown as [
            { uri: string; crop?: { x: number; y: number; width: number; height: number } },
          ][]
        ).map(([photo]) => [photo.uri, photo.crop]),
      );

    async function openEditorSquare() {
      await compose(1);
      await press(screen.getByTestId('pick-photo-1'));
      await waitFor(() => expect(screen.getByTestId('editor-frame')).toBeTruthy());
      await act(async () => {
        fireEvent.press(screen.getByTestId('editor-shape-square'));
      });
    }

    it('dragging the photo saves where it was framed', async () => {
      await openEditorSquare();
      await act(async () => {
        fireGestureHandler(getByGestureTestId('editor-pan'), [
          { state: State.BEGAN },
          { state: State.ACTIVE, translationX: 0, changeX: 0 },
          { state: State.ACTIVE, translationX: 60, changeX: 60 },
          { state: State.END, translationX: 60 },
        ]);
      });
      await editorNext();
      await share();
      const crop = cropsSent()['file:///1.jpg'];
      // Dragged right, so it keeps more of the left side than the centered crop would.
      expect(crop?.width).toBeCloseTo(9 / 16);
      expect(crop?.x).toBeLessThan((1 - 9 / 16) / 2);
    });

    it('pinching zooms in around the fingers, and saves it', async () => {
      await openEditorSquare();
      const frame = StyleSheet.flatten(screen.getByTestId('editor-frame').props.style);
      await act(async () => {
        fireGestureHandler(getByGestureTestId('editor-pinch'), [
          { state: State.BEGAN },
          { state: State.ACTIVE, scale: 1, scaleChange: 1, focalX: 0, focalY: frame.height / 2 },
          // Twice as big, pinched at the left edge, so the left edge stays put.
          { state: State.ACTIVE, scale: 2, scaleChange: 2, focalX: 0, focalY: frame.height / 2 },
          { state: State.END, scale: 2 },
        ]);
      });
      await editorNext();
      // The caption step shows the photo as framed: a square, zoomed in from the left.
      const thumb = StyleSheet.flatten(screen.getByTestId('compose-photo-1').props.style);
      const shown = StyleSheet.flatten(screen.getByTestId('compose-photo-1-image').props.style);
      expect(thumb.width).toBe(thumb.height);
      expect(shown.width).toBeCloseTo(thumb.width / (9 / 32));
      expect(shown.left).toBeCloseTo(-((1 - 9 / 16) / 2) * shown.width);
      expect(shown.top).toBeCloseTo(-shown.height / 4);
      await share();
      const crop = cropsSent()['file:///1.jpg'];
      // Half as much shows; the left edge of what showed before is still the left edge.
      expect(crop?.width).toBeCloseTo(9 / 32);
      expect(crop?.height).toBeCloseTo(1 / 2);
      expect(crop?.x).toBeCloseTo((1 - 9 / 16) / 2);
      expect(crop?.y).toBeCloseTo(1 / 4);
    });
  });

  it('Cancel closes posting and starts fresh next time', async () => {
    await compose(1);
    await toCaption();
    await type('compose-caption', 'Not this one');
    await press(screen.getByTestId('compose-back'));
    await waitFor(() => expect(screen.getByTestId('editor-back')).toBeTruthy());
    await press(screen.getByTestId('editor-back'));
    await waitFor(() => expect(screen).toHavePathname('/new-post'));
    await press(screen.getByTestId('pick-cancel'));
    await waitFor(() => expect(screen).toHavePathname('/home'));
    await press(screen.getByTestId('tab-post'));
    await waitFor(() => expect(screen.getByTestId('pick-next')).toBeTruthy());
    expect(screen.queryByTestId('pick-photo-1')).toBeNull();
    await toCaption();
    expect(screen.getByTestId('compose-caption').props.value).toBe('');
  });
});

describe('upload progress and retry', () => {
  it('shrinks every photo before it goes up', async () => {
    await compose(1, 2);
    await toCaption();
    await press(screen.getByTestId('compose-share'));
    expect(preparePhoto).toHaveBeenCalledTimes(2);
    expect(preparePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///1.jpg', width: 1000, height: 1000 }),
      1,
    );
  });

  it('shows which photo is uploading and how far along it is', async () => {
    let finish: () => void = () => {};
    let report: (f: number) => void = () => {};
    posts.uploadPostPhoto.mockImplementationOnce(
      (_u: string, _p: string, _i: number, _uri: string, onProgress?: unknown) =>
        new Promise<string>((resolve) => {
          report = onProgress as (f: number) => void;
          finish = () => resolve('posts/me/new-post/0.jpg');
        }),
    );
    await compose(1, 2);
    await toCaption();
    await press(screen.getByTestId('compose-share'));
    expect(screen.getByTestId('compose-progress')).toHaveTextContent(/Uploading 1 of 2/);
    await act(async () => report(0.5));
    expect(screen.getByTestId('compose-progress-bar').props.accessibilityLabel).toBe(
      'Upload 25 percent done',
    );
    await act(async () => finish());
    await waitFor(() => expect(screen.getByTestId('posted')).toBeTruthy());
  });

  it('retries without re-sending photos that made it, or losing the caption', async () => {
    posts.uploadPostPhoto
      .mockImplementationOnce(async () => 'posts/me/new-post/0.jpg')
      .mockRejectedValueOnce(new Error('network'));
    await compose(1, 2);
    await toCaption();
    await type('compose-caption', 'Keep me');
    await press(screen.getByTestId('compose-share'));
    await waitFor(() => expect(screen.getByTestId('compose-retry')).toBeTruthy());
    expect(screen.getByTestId('compose-share')).toHaveTextContent('Retry');
    expect(screen.getByTestId('compose-caption').props.value).toBe('Keep me');
    expect(posts.createPost).not.toHaveBeenCalled();

    await press(screen.getByTestId('compose-retry'));
    await waitFor(() => expect(screen.getByTestId('posted')).toBeTruthy());
    // Photo 1 went up once; photo 2 was tried twice, under a new name the second time.
    const uris = posts.uploadPostPhoto.mock.calls.map((c) => c[3]);
    expect(uris).toEqual(['file:///1-small.jpg', 'file:///2-small.jpg', 'file:///2-small.jpg']);
    expect(posts.uploadPostPhoto.mock.calls.map((c) => c[2])).toEqual([0, 1, 2]);
    // One post ID across both tries.
    expect(posts.newPostId).toHaveBeenCalledTimes(1);
    expect(posts.createPost).toHaveBeenCalledWith(
      'new-post',
      me(),
      expect.objectContaining({
        caption: 'Keep me',
        photoPaths: ['posts/me/new-post/0.jpg', `posts/${me()}/new-post/2.jpg`],
      }),
    );
  });

  it('retries the post itself when only that failed', async () => {
    posts.createPost.mockRejectedValueOnce(new Error('offline'));
    await compose(1);
    await toCaption();
    await press(screen.getByTestId('compose-share'));
    await waitFor(() => expect(screen.getByTestId('compose-retry')).toBeTruthy());
    await press(screen.getByTestId('compose-retry'));
    await waitFor(() => expect(screen.getByTestId('posted')).toBeTruthy());
    expect(posts.uploadPostPhoto).toHaveBeenCalledTimes(1);
    expect(posts.createPost).toHaveBeenCalledTimes(2);
  });
});

describe('when officers paused posting (#50)', () => {
  it('explains why and keeps Share off', async () => {
    mod.setMockRestriction(new Date(2026, 10, 5, 12));
    await compose();
    await toCaption();
    await waitFor(() => expect(screen.getByTestId('compose-paused')).toBeTruthy());
    expect(screen.getByTestId('compose-paused')).toHaveTextContent(
      'Officers paused your posting and commenting until Nov 5.',
    );
    await type('compose-caption', 'Trying anyway');
    expect(screen.getByTestId('compose-share').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await press(screen.getByTestId('compose-share'));
    expect(posts.createPost).not.toHaveBeenCalled();
  });
});
