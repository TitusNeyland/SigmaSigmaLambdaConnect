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
const events = jest.requireMock<typeof import('@/data/__mocks__/events')>('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
const feed = jest.requireMock<typeof import('@/data/__mocks__/feed')>('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
const posts = jest.requireMock<typeof import('@/data/__mocks__/posts')>('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/features/post/pickPhotos', () => ({
  pickFromLibrary: jest.fn(),
  takePhoto: jest.fn(),
}));

const me = () => auth.sampleUser().uid;
const GALA = events.sampleEvent({
  id: 'gala',
  title: 'Sample scholarship gala',
  location: 'Hotel ballroom',
  startsAt: new Date(Date.now() + 5 * 86_400_000),
});

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
  posts.resetPostsMock();
  events.resetEventsMock([GALA]);
  feed.resetFeedMock([
    feed.samplePost({
      id: 'official',
      authorId: 'sample-jordan',
      official: true,
      eventId: 'gala',
      caption: 'Sample: get your tickets',
    }),
    feed.samplePost({ id: 'normal', authorId: 'sample-chris' }),
  ]);
});

async function openHome() {
  await renderRouter('src/app', { initialUrl: '/home' });
  await waitFor(() => expect(screen.getByTestId('post-official')).toBeTruthy());
}

describe('in the feed', () => {
  it('speaks as Sigma Sigma Lambda with a gold verified badge', async () => {
    await openHome();
    expect(screen.getByTestId('post-author-official').props.accessibilityLabel).toMatch(
      /^Sigma Sigma Lambda, verified, Official chapter post, /,
    );
    expect(screen.getByLabelText('Verified chapter account')).toBeTruthy();
    expect(screen.getByTestId('caption-official')).toHaveTextContent(/^Sigma Sigma Lambda Sample/);
    // Ordinary posts keep their author.
    expect(screen.getByTestId('post-author-normal').props.accessibilityLabel).toMatch(
      /^Marcus Reed/,
    );
  });

  it('shows the tagged event with an RSVP button', async () => {
    await openHome();
    await waitFor(() => expect(screen.getByTestId('official-event-gala')).toBeTruthy());
    expect(events.fetchEventSummary).toHaveBeenCalledWith('gala', me());
    await press(screen.getByTestId('official-going-gala'));
    expect(events.setRsvp).toHaveBeenCalledWith('gala', me(), 'going');
    expect(screen.getByTestId('official-rsvp-gala')).toHaveTextContent(
      'You said going. Change it on the event.',
    );
  });

  it('says so when RSVPs are closed, and goes back to the button', async () => {
    events.setRsvp.mockRejectedValueOnce(new events.RsvpSaveError('closed'));
    await openHome();
    await waitFor(() => expect(screen.getByTestId('official-going-gala')).toBeTruthy());
    await press(screen.getByTestId('official-going-gala'));
    await waitFor(() => expect(screen.getByText('RSVPs are closed for this event.')).toBeTruthy());
    expect(screen.getByTestId('official-going-gala')).toBeTruthy();
  });

  it('opens the event from the card', async () => {
    events.setMockDetails({ gala: events.sampleDetail({ id: 'gala' }) });
    await openHome();
    await waitFor(() => expect(screen.getByTestId('official-event-open-gala')).toBeTruthy());
    await press(screen.getByTestId('official-event-open-gala'));
    await waitFor(() => expect(screen).toHavePathname('/events/gala'));
  });

  it('leaves the card out when the event is gone', async () => {
    events.resetEventsMock([]);
    await openHome();
    await waitFor(() => expect(events.fetchEventSummary).toHaveBeenCalled());
    expect(screen.queryByTestId('official-event-gala')).toBeNull();
  });
});

describe('posting officially', () => {
  async function compose() {
    await renderRouter('src/app', { initialUrl: '/new-post' });
    await waitFor(() => expect(screen.getByTestId('post-text-only')).toBeTruthy());
    await press(screen.getByTestId('post-text-only'));
    await waitFor(() => expect(screen.getByTestId('compose-caption')).toBeTruthy());
  }

  it('officers can post as Sigma Sigma Lambda', async () => {
    signIn({ role: 'officer', title: 'Secretary' });
    await compose();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('compose-caption'), 'Chapter meeting moved');
      fireEvent(screen.getByTestId('compose-official'), 'valueChange', true);
    });
    await press(screen.getByTestId('compose-share'));
    expect(posts.createPost).toHaveBeenCalledWith(
      'new-post',
      me(),
      expect.objectContaining({ official: true }),
    );
  });

  it('members never see the option, and their posts are never official', async () => {
    await compose();
    expect(screen.queryByTestId('compose-official')).toBeNull();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('compose-caption'), 'Hi');
    });
    await press(screen.getByTestId('compose-share'));
    expect(posts.createPost).toHaveBeenCalledWith(
      'new-post',
      me(),
      expect.objectContaining({ official: false }),
    );
  });
});
