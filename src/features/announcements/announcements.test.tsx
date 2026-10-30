import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
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
const ann =
  jest.requireMock<typeof import('@/data/__mocks__/announcements')>('@/data/announcements');

const me = () => auth.sampleUser().uid;

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

function signIn(role: Parameters<typeof roles.resetRolesMock>[0]) {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  roles.resetRolesMock(role);
  auth.setMockUser(auth.sampleUser());
}

beforeEach(() => {
  signIn(null);
  ann.resetAnnouncementsMock([
    ann.sampleAnnouncement({
      id: 'dues',
      title: 'Sample dues reminder',
      createdAt: new Date(Date.now() - 2 * 3600_000),
    }),
    ann.sampleAnnouncement({
      id: 'service',
      title: 'Sample service sign-ups',
      pinned: true,
      authorTitle: 'President',
      createdAt: new Date(Date.now() - 86_400_000),
    }),
    ann.sampleAnnouncement({
      id: 'old',
      title: 'Sample old news',
      createdAt: new Date(Date.now() - 5 * 86_400_000),
    }),
  ]);
});

async function openChapter() {
  await renderRouter('src/app', { initialUrl: '/chapter' });
  await waitFor(() => expect(screen.getByTestId('announcement-dues')).toBeTruthy());
}

const order = () =>
  screen
    .queryAllByTestId(/^announcement-(?!body-)[a-z0-9-]+$/)
    .map((r) => String(r.props.testID).replace('announcement-', ''));

describe('reading', () => {
  it('shows pinned first, then newest, with unread dots and a count', async () => {
    ann.setMockReads(['old']);
    await openChapter();
    expect(order()).toEqual(['service', 'dues', 'old']);
    expect(screen.getByTestId('unread-service')).toBeTruthy();
    expect(screen.getByTestId('unread-dues')).toBeTruthy();
    expect(screen.queryByTestId('unread-old')).toBeNull();
    expect(screen.getByRole('header', { name: 'ANNOUNCEMENTS · 2 NEW' })).toBeTruthy();
    expect(screen.getByTestId('announcement-service').props.accessibilityLabel).toMatch(
      /^Unread\. Sample service sign-ups, Pinned · President · /,
    );
  });

  it('tapping expands it and marks it read', async () => {
    await openChapter();
    expect(screen.queryByTestId('announcement-body-dues')).toBeNull();
    await press(screen.getByTestId('announcement-dues'));
    expect(screen.getByTestId('announcement-body-dues')).toHaveTextContent(
      'Sample. Use the link the Treasurer shared.',
    );
    expect(ann.markRead).toHaveBeenCalledWith(me(), 'dues');
    await waitFor(() => expect(screen.queryByTestId('unread-dues')).toBeNull());
    // Tapping again collapses it without marking it again.
    await press(screen.getByTestId('announcement-dues'));
    expect(screen.queryByTestId('announcement-body-dues')).toBeNull();
    expect(ann.markRead).toHaveBeenCalledTimes(1);
  });

  it('has an empty state', async () => {
    ann.resetAnnouncementsMock([]);
    await renderRouter('src/app', { initialUrl: '/chapter' });
    await waitFor(() => expect(screen.getByTestId('announcements-empty')).toBeTruthy());
  });

  it('members can’t post', async () => {
    await openChapter();
    expect(screen.queryByTestId('new-announcement')).toBeNull();
    await renderRouter('src/app', { initialUrl: '/chapter/announcements/new' });
    await waitFor(() =>
      expect(screen.getByText('Only chapter officers can post announcements.')).toBeTruthy(),
    );
  });
});

describe('posting', () => {
  beforeEach(() => signIn({ role: 'officer', title: 'Treasurer' }));

  it('officers post one, with their title, and it shows at once', async () => {
    await openChapter();
    await press(screen.getByTestId('new-announcement'));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'New announcement' })).toBeTruthy(),
    );
    expect(screen.getByTestId('announce-post').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('announce-title'), 'Chapter photo Sunday');
      fireEvent.changeText(screen.getByTestId('announce-body'), 'Wear letters.');
      fireEvent(screen.getByTestId('announce-pinned'), 'valueChange', true);
    });
    await press(screen.getByTestId('announce-post'));
    expect(ann.postAnnouncement).toHaveBeenCalledWith(me(), {
      title: 'Chapter photo Sunday',
      body: 'Wear letters.',
      pinned: true,
      authorTitle: 'Treasurer',
    });
    await waitFor(() => expect(screen).toHavePathname('/chapter'));
    await waitFor(() => expect(order()[0]).toBe('new-1'));
  });

  it('keeps what was written and says so when posting fails', async () => {
    ann.postAnnouncement.mockRejectedValueOnce(new Error('offline'));
    await renderRouter('src/app', { initialUrl: '/chapter/announcements/new' });
    await waitFor(() => expect(screen.getByTestId('announce-title')).toBeTruthy());
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('announce-title'), 'Keep');
      fireEvent.changeText(screen.getByTestId('announce-body'), 'Me');
    });
    await press(screen.getByTestId('announce-post'));
    await waitFor(() => expect(screen.getByTestId('announce-error')).toBeTruthy());
    expect(screen.getByTestId('announce-title').props.value).toBe('Keep');
  });
});
