import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
const profile = jest.requireMock<typeof import('@/data/__mocks__/profile')>('@/data/profile');
jest.mock('@/data/blocks');
const blocks = jest.requireMock<typeof import('@/data/__mocks__/blocks')>('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
const directory = jest.requireMock<typeof import('@/data/__mocks__/directory')>('@/data/directory');
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
const reports = jest.requireMock<typeof import('@/data/__mocks__/reports')>('@/data/reports');

const OTHER = 'sample-chris';

// Another member's public profile: contact fields only hold what he chose to show.
const chris = (overrides: Parameters<typeof profile.sampleProfile>[0] = {}) =>
  profile.sampleProfile({
    displayName: 'Chris Baptiste',
    headline: 'Nurse',
    initiationTerm: 'Fall 2021',
    bio: 'Service chair.',
    interests: ['Golf'],
    email: '',
    phone: '',
    showEmail: false,
    showPhone: false,
    ...overrides,
  });

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
  roles.resetRolesMock(null);
  profile.resetProfileMock();
  profile.setMockProfilesFor({ [OTHER]: chris() });
  blocks.resetBlocksMock();
  reports.resetReportsMock();
  directory.resetDirectoryMock();
  auth.setMockUser(auth.sampleUser());
});

async function openMember(uid = OTHER) {
  await renderRouter('src/app', { initialUrl: `/chapter/member/${uid}` });
  await waitFor(() => expect(screen.getByRole('header', { name: 'Chris Baptiste' })).toBeTruthy());
}

async function openMenu() {
  await press(screen.getByRole('button', { name: 'More' }));
}

describe('layout', () => {
  it('shows the same profile layout as My profile, without edit controls', async () => {
    await openMember();
    expect(screen.getByText('Nurse · Initiated Fall 2021')).toBeTruthy();
    expect(screen.getByText('Service chair.')).toBeTruthy();
    expect(screen.getByText('Golf')).toBeTruthy();
    expect(screen.queryByTestId('edit-profile')).toBeNull();
    expect(screen.queryByTestId('open-settings')).toBeNull();
    expect(profile.subscribeToProfile).toHaveBeenCalledWith(
      OTHER,
      expect.any(Function),
      expect.any(Function),
      { own: false },
    );
  });

  it('shows his officer title as a badge', async () => {
    roles.setMockRolesFor({ [OTHER]: { role: 'officer', title: 'Service Chair' } });
    await openMember();
    await waitFor(() => expect(screen.getByTestId('role-chip')).toHaveTextContent('Service Chair'));
  });

  it('shows no badge for a regular member', async () => {
    await openMember();
    expect(roles.fetchRole).toHaveBeenCalledWith(OTHER);
    expect(screen.queryByTestId('role-chip')).toBeNull();
  });

  it('hides attendance from regular members', async () => {
    await openMember();
    expect(profile.fetchProfileStats).toHaveBeenCalledWith(OTHER, { includeAttendance: false });
    expect(profile.fetchActivity).not.toHaveBeenCalled();
    expect(screen.queryByTestId('stat-events')).toBeNull();
    expect(screen.queryByTestId('profile-tabs')).toBeNull();
  });

  it('shows attendance to officers', async () => {
    roles.resetRolesMock({ role: 'officer', title: 'Secretary' });
    profile.setMockProfilesFor({ [OTHER]: chris() });
    await openMember();
    await waitFor(() =>
      expect(profile.fetchProfileStats).toHaveBeenCalledWith(OTHER, { includeAttendance: true }),
    );
    await waitFor(() => expect(screen.getByTestId('profile-tabs')).toBeTruthy());
    await press(screen.getByRole('tab', { name: 'Activity' }));
    expect(
      screen.getByText('Only this brother and chapter officers can see his attendance history.'),
    ).toBeTruthy();
  });

  it('says so when the profile is gone', async () => {
    profile.setMockProfilesFor({ [OTHER]: null });
    await renderRouter('src/app', { initialUrl: `/chapter/member/${OTHER}` });
    await waitFor(() => expect(screen.getByText('This profile isn’t available.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('sends you to your own profile when you open yourself', async () => {
    await renderRouter('src/app', { initialUrl: `/chapter/member/${auth.sampleUser().uid}` });
    await waitFor(() => expect(screen).toHavePathname('/profile'));
  });

  it('opens from the directory and goes back to it', async () => {
    directory.resetDirectoryMock([
      directory.sampleEntry({ uid: OTHER, displayName: 'Chris Baptiste' }),
    ]);
    await renderRouter('src/app', { initialUrl: '/chapter/directory' });
    await waitFor(() => expect(screen.getByTestId(`member-${OTHER}`)).toBeTruthy());
    await press(screen.getByTestId(`member-${OTHER}`));
    await waitFor(() => expect(screen.getByTestId('member-back')).toBeTruthy());
    await press(screen.getByTestId('member-back'));
    await waitFor(() => expect(screen).toHavePathname('/chapter/directory'));
  });
});

describe('contact details follow his privacy settings', () => {
  it('shows no contact buttons when he hides both', async () => {
    await openMember();
    expect(screen.queryByTestId('contact-email')).toBeNull();
    expect(screen.queryByTestId('contact-phone')).toBeNull();
  });

  it('offers email and call when he shows them', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    profile.setMockProfilesFor({
      [OTHER]: chris({ email: 'chris@example.com', phone: '(555) 010-0123' }),
    });
    await openMember();
    await press(screen.getByRole('button', { name: 'Email Chris Baptiste' }));
    expect(open).toHaveBeenCalledWith('mailto:chris@example.com');
    await press(screen.getByRole('button', { name: 'Call Chris Baptiste' }));
    expect(open).toHaveBeenCalledWith('tel:5550100123');
    open.mockRestore();
  });

  it('shows only the one he chose', async () => {
    profile.setMockProfilesFor({ [OTHER]: chris({ phone: '555-0123' }) });
    await openMember();
    expect(screen.queryByTestId('contact-email')).toBeNull();
    expect(screen.getByTestId('contact-phone')).toBeTruthy();
  });
});

describe('report', () => {
  it('sends a report with the chosen reason and thanks you', async () => {
    await openMember();
    await openMenu();
    await press(screen.getByTestId('menu-report'));
    expect(
      screen.getByText('Only chapter officers see reports. Chris Baptiste won’t know it was you.'),
    ).toBeTruthy();
    for (const label of ['Spam', 'Harassment or bullying', 'Inappropriate', 'Something else']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    await press(screen.getByRole('button', { name: 'Harassment or bullying' }));
    expect(reports.reportMember).toHaveBeenCalledWith(auth.sampleUser().uid, OTHER, 'harassment');
    await waitFor(() => expect(screen.getByText('Thanks for reporting')).toBeTruthy());
    await press(screen.getByTestId('report-done'));
    await waitFor(() => expect(screen.queryByText('Thanks for reporting')).toBeNull());
  });

  it('says so when the report fails', async () => {
    reports.reportMember.mockRejectedValueOnce(new Error('offline'));
    await openMember();
    await openMenu();
    await press(screen.getByTestId('menu-report'));
    await press(screen.getByTestId('report-spam'));
    await waitFor(() =>
      expect(screen.getByText('Couldn’t send your report. Try again.')).toBeTruthy(),
    );
    expect(screen.queryByText('Thanks for reporting')).toBeNull();
  });
});

describe('block', () => {
  it('confirms first, then blocks', async () => {
    await openMember();
    await openMenu();
    await press(screen.getByTestId('menu-block'));
    expect(screen.getByText('Block Chris Baptiste?')).toBeTruthy();
    expect(
      screen.getByText('They won’t be told. You can unblock them any time in Settings.'),
    ).toBeTruthy();
    expect(blocks.block).not.toHaveBeenCalled();
    await press(screen.getByTestId('confirm-block'));
    expect(blocks.block).toHaveBeenCalledWith(auth.sampleUser().uid, OTHER);
    await waitFor(() => expect(screen.getByTestId('blocked-banner')).toBeTruthy());
  });

  it('cancel does nothing', async () => {
    await openMember();
    await openMenu();
    await press(screen.getByTestId('menu-block'));
    await press(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(blocks.block).not.toHaveBeenCalled();
  });

  it('offers unblock for someone already blocked', async () => {
    blocks.resetBlocksMock([{ uid: OTHER, displayName: 'Chris Baptiste', photoURL: null }]);
    await openMember();
    expect(screen.getByText('You blocked Chris Baptiste. They aren’t told.')).toBeTruthy();
    await openMenu();
    expect(screen.queryByTestId('menu-block')).toBeNull();
    await press(screen.getByTestId('menu-unblock'));
    expect(blocks.unblock).toHaveBeenCalledWith(auth.sampleUser().uid, OTHER);
    await waitFor(() => expect(screen.queryByTestId('blocked-banner')).toBeNull());
  });

  it('keeps the sheet open with an error when blocking fails', async () => {
    blocks.block.mockRejectedValueOnce(new Error('offline'));
    await openMember();
    await openMenu();
    await press(screen.getByTestId('menu-block'));
    await press(screen.getByTestId('confirm-block'));
    await waitFor(() =>
      expect(screen.getByText('Couldn’t block Chris Baptiste. Try again.')).toBeTruthy(),
    );
    expect(screen.queryByTestId('blocked-banner')).toBeNull();
  });
});
