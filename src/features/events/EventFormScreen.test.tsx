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
jest.mock('@/data/likes');
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
jest.mock('@/data/announcements');
const admin = jest.requireMock<typeof import('@/data/__mocks__/eventAdmin')>('@/data/eventAdmin');
jest.mock('./pickEventPhoto', () => ({ pickEventPhoto: jest.fn(), EVENT_PHOTO_WIDTH: 1600 }));
const { pickEventPhoto } = jest.requireMock<typeof import('./pickEventPhoto')>('./pickEventPhoto');

const inDays = (n: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const GALA = events.sampleDetail({
  id: 'gala',
  title: 'Sample scholarship gala',
  category: 'fundraiser',
  description: 'Sample dinner.',
  startsAt: inDays(9, 19),
  endsAt: inDays(9, 22),
  location: 'Hotel ballroom',
  address: '200 Sample Ave',
  feeCents: 2500,
  rsvpDeadline: inDays(7, 17),
  photoURL: 'https://example.test/gala.jpg',
});

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

function signIn(role: Parameters<typeof roles.resetRolesMock>[0]) {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  roles.resetRolesMock(role);
  auth.setMockUser(auth.sampleUser());
}

const OFFICER = { role: 'officer' as const, title: 'Secretary' };

beforeEach(() => {
  signIn(OFFICER);
  events.resetEventsMock([]);
  events.setMockDetails({ gala: GALA });
  admin.resetEventAdminMock();
  jest.mocked(pickEventPhoto).mockReset();
});

describe('who can create and edit', () => {
  it('officers get New on the Events tab and Edit on an event', async () => {
    await renderRouter('src/app', { initialUrl: '/events' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'New event' })).toBeTruthy());
    await press(screen.getByRole('button', { name: 'New event' }));
    await waitFor(() => expect(screen.getByRole('header', { name: 'New event' })).toBeTruthy());
  });

  it('officers can open Edit from an event', async () => {
    await renderRouter('src/app', { initialUrl: '/events/gala' });
    await waitFor(() => expect(screen.getByTestId('edit-event')).toBeTruthy());
    await press(screen.getByTestId('edit-event'));
    await waitFor(() => expect(screen).toHavePathname('/events/gala/edit'));
  });

  it('members see neither, and the form turns them away', async () => {
    signIn(null);
    await renderRouter('src/app', { initialUrl: '/events/gala' });
    await waitFor(() => expect(screen.getByText('Hosted by Jordan Hill')).toBeTruthy());
    expect(screen.queryByTestId('edit-event')).toBeNull();

    await renderRouter('src/app', { initialUrl: '/events' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Events' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'New event' })).toBeNull();

    await renderRouter('src/app', { initialUrl: '/events/new' });
    await waitFor(() =>
      expect(screen.getByText('Only chapter officers can create and edit events.')).toBeTruthy(),
    );
  });
});

describe('create', () => {
  async function openNew() {
    await renderRouter('src/app', { initialUrl: '/events/new' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'New event' })).toBeTruthy());
  }

  it('creates an event with every field, then opens it', async () => {
    await openNew();
    await type('event-form-title', '  Sample cookout ');
    await press(screen.getByRole('button', { name: 'Social' }));
    await type('event-form-location', 'Riverside Park');
    await type('event-form-address', '1 Park Rd');
    await type('event-form-fee', '10');
    await type('event-form-description', 'Sample cookout for families.');
    const start = inDays(14, 16);
    await act(async () => {
      screen.getByTestId('event-form-starts').props.onChange({ type: 'set' }, start);
    });
    await press(screen.getByTestId('event-form-save'));

    expect(admin.createEvent).toHaveBeenCalledWith(
      'new-event',
      auth.sampleUser().uid,
      expect.objectContaining({
        title: 'Sample cookout',
        category: 'social',
        location: 'Riverside Park',
        address: '1 Park Rd',
        feeCents: 1000,
        description: 'Sample cookout for families.',
        startsAt: start,
        photoURL: null,
      }),
    );
    const saved = jest.mocked(admin.createEvent).mock.calls[0][2];
    // Moving the start moved the end and the deadline with it.
    expect(saved.endsAt!.getTime() - start.getTime()).toBe(2 * 3600_000);
    expect(start.getTime() - saved.rsvpDeadline.getTime()).toBe(24 * 3600_000);
    await waitFor(() => expect(screen).toHavePathname('/events/new-event'));
  });

  it('shows what’s missing and saves nothing', async () => {
    await openNew();
    await type('event-form-fee', 'abc');
    await press(screen.getByTestId('event-form-save'));
    expect(screen.getByText('Give the event a name.')).toBeTruthy();
    expect(screen.getByText('Where is it?')).toBeTruthy();
    expect(screen.getByText('Enter a price like 25 or 12.50, or leave it empty.')).toBeTruthy();
    expect(admin.createEvent).not.toHaveBeenCalled();
  });

  it('can drop the end time', async () => {
    await openNew();
    await type('event-form-title', 'Sample meeting');
    await type('event-form-location', 'Chapter house');
    await act(async () => {
      fireEvent(screen.getByTestId('event-form-has-end'), 'valueChange', false);
    });
    expect(screen.queryByTestId('event-form-ends')).toBeNull();
    await press(screen.getByTestId('event-form-save'));
    expect(jest.mocked(admin.createEvent).mock.calls[0][2].endsAt).toBeNull();
  });

  it('uploads a chosen photo under the new event before saving', async () => {
    jest.mocked(pickEventPhoto).mockResolvedValue({ status: 'picked', uri: 'file:///p.jpg' });
    await openNew();
    await type('event-form-title', 'Sample meeting');
    await type('event-form-location', 'Chapter house');
    await press(screen.getByTestId('event-form-pick-photo'));
    await waitFor(() => expect(screen.getByTestId('event-form-photo')).toBeTruthy());
    await press(screen.getByTestId('event-form-save'));
    expect(admin.uploadEventPhoto).toHaveBeenCalledWith('new-event', 'file:///p.jpg');
    expect(jest.mocked(admin.createEvent).mock.calls[0][2].photoURL).toBe(
      'https://example.test/events/new-event.jpg',
    );
  });

  it('explains when photo access is off', async () => {
    jest.mocked(pickEventPhoto).mockResolvedValue({ status: 'denied' });
    await openNew();
    await press(screen.getByTestId('event-form-pick-photo'));
    await waitFor(() =>
      expect(
        screen.getByText('Allow photo access in Settings to add an event photo.'),
      ).toBeTruthy(),
    );
  });

  it('keeps the form and says so when saving fails', async () => {
    admin.createEvent.mockRejectedValueOnce(new Error('offline'));
    await openNew();
    await type('event-form-title', 'Sample meeting');
    await type('event-form-location', 'Chapter house');
    await press(screen.getByTestId('event-form-save'));
    await waitFor(() =>
      expect(screen.getByTestId('event-form-error')).toHaveTextContent(
        'Couldn’t save the event. Check your connection and try again.',
      ),
    );
    expect(screen).toHavePathname('/events/new');
  });
});

describe('edit and cancel', () => {
  async function openEdit() {
    await renderRouter('src/app', { initialUrl: '/events/gala/edit' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Edit event' })).toBeTruthy());
  }

  it('starts filled in with the event', async () => {
    await openEdit();
    expect(screen.getByTestId('event-form-title').props.value).toBe('Sample scholarship gala');
    expect(screen.getByTestId('event-form-location').props.value).toBe('Hotel ballroom');
    expect(screen.getByTestId('event-form-fee').props.value).toBe('25');
    expect(
      screen.getByRole('button', { name: 'Fundraiser' }).props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('event-form-photo')).toBeTruthy();
  });

  it('saves changes and goes back', async () => {
    await renderRouter('src/app', { initialUrl: '/events/gala' });
    await waitFor(() => expect(screen.getByTestId('edit-event')).toBeTruthy());
    await press(screen.getByTestId('edit-event'));
    await waitFor(() => expect(screen.getByTestId('event-form-title')).toBeTruthy());
    await type('event-form-title', 'Sample scholarship gala and auction');
    await press(screen.getByTestId('event-form-remove-photo'));
    await press(screen.getByTestId('event-form-save'));
    expect(admin.updateEvent).toHaveBeenCalledWith(
      'gala',
      expect.objectContaining({ title: 'Sample scholarship gala and auction', photoURL: null }),
    );
    expect(admin.createEvent).not.toHaveBeenCalled();
    await waitFor(() => expect(screen).toHavePathname('/events/gala'));
  });

  it('cancels only after confirming, and tells the officer who gets notified', async () => {
    await openEdit();
    await press(screen.getByTestId('event-form-cancel-event'));
    expect(screen.getByText('Cancel Sample scholarship gala?')).toBeTruthy();
    expect(
      screen.getByText(
        'Everyone who said Going or Maybe gets a notification. RSVPs close. This can’t be undone.',
      ),
    ).toBeTruthy();
    expect(admin.cancelEvent).not.toHaveBeenCalled();
    await press(screen.getByTestId('confirm-cancel-event'));
    expect(admin.cancelEvent).toHaveBeenCalledWith('gala');
  });

  it('keep it does nothing', async () => {
    await openEdit();
    await press(screen.getByTestId('event-form-cancel-event'));
    await press(screen.getByRole('button', { name: 'Keep it' }));
    expect(admin.cancelEvent).not.toHaveBeenCalled();
  });

  it('has no cancel option once cancelled', async () => {
    events.setMockDetails({ gala: { ...GALA, cancelled: true } });
    await openEdit();
    expect(screen.queryByTestId('event-form-cancel-event')).toBeNull();
  });

  it('lets you edit an event that already started', async () => {
    events.setMockDetails({
      gala: { ...GALA, startsAt: inDays(-1, 19), endsAt: null, rsvpDeadline: inDays(-2, 9) },
    });
    await openEdit();
    await type('event-form-description', 'Thanks to everyone who came.');
    await press(screen.getByTestId('event-form-save'));
    expect(admin.updateEvent).toHaveBeenCalled();
  });
});
