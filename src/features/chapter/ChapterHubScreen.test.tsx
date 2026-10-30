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
const directory = jest.requireMock<typeof import('@/data/__mocks__/directory')>('@/data/directory');
jest.mock('@/data/reports');
jest.mock('@/data/events');
jest.mock('@/data/eventAdmin');
jest.mock('@/data/feed');
jest.mock('@/data/likes');
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
const programs = jest.requireMock<typeof import('@/data/__mocks__/programs')>('@/data/programs');
jest.mock('@/data/announcements');
const ann =
  jest.requireMock<typeof import('@/data/__mocks__/announcements')>('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
const leadership =
  jest.requireMock<typeof import('@/data/__mocks__/leadership')>('@/data/leadership');

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
  ann.resetAnnouncementsMock();
  leadership.resetLeadershipMock();
  programs.resetProgramsMock([
    programs.sampleProgram(),
    programs.sampleProgram({ id: 'sample-drive', status: 'at_risk' }),
  ]);
  directory.resetDirectoryMock([
    directory.sampleEntry({ uid: 'sample-member', displayName: 'Sample Member' }),
    directory.sampleEntry({
      uid: 'sample-pres',
      displayName: 'Sample President',
      role: { role: 'officer', title: 'President' },
    }),
  ]);
});

async function openChapter() {
  const r = await renderRouter('src/app', { initialUrl: '/chapter' });
  await waitFor(() => expect(screen.getByTestId('progress-line')).toBeTruthy());
  return r;
}

describe('everyone', () => {
  it('shows progress, tiles and officers, with no leadership card', async () => {
    await openChapter();
    expect(screen.getByRole('header', { name: 'Chapter' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('progress-line')).toHaveTextContent(
        '50% of milestones done · 1 program needs help',
      ),
    );
    for (const t of ['programs', 'calendar', 'documents']) {
      expect(screen.getByTestId(`tile-${t}`)).toBeTruthy();
    }
    await waitFor(() => expect(screen.getByTestId('officer-sample-pres')).toBeTruthy());
    expect(screen.queryByTestId('officer-sample-member')).toBeNull();
    expect(screen.queryByTestId('leadership-entry')).toBeNull();
    expect(leadership.fetchWaitingCounts).not.toHaveBeenCalled();
  });

  it('progress card and Programs tile open chapter progress', async () => {
    const r = await openChapter();
    await press(screen.getByTestId('progress-card'));
    expect(r.getPathname()).toBe('/chapter/progress');
  });

  it('Programs tile opens chapter progress', async () => {
    const r = await openChapter();
    await press(screen.getByTestId('tile-programs'));
    expect(r.getPathname()).toBe('/chapter/progress');
  });

  it('Directory tile opens the directory', async () => {
    const r = await openChapter();
    await press(screen.getByTestId('directory-entry'));
    expect(r.getPathname()).toBe('/chapter/directory');
  });

  it('Calendar tile opens Events in calendar view', async () => {
    const r = await openChapter();
    await press(screen.getByTestId('tile-calendar'));
    expect(r.getPathname()).toBe('/events');
    expect(r.getSearchParams()).toMatchObject({ view: 'calendar' });
  });

  it('Documents is marked coming soon and does nothing', async () => {
    await openChapter();
    const tile = screen.getByTestId('tile-documents');
    expect(tile.props.accessibilityLabel).toBe('Documents, Coming soon');
    expect(tile.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('tapping an officer opens their profile', async () => {
    const r = await openChapter();
    await waitFor(() => expect(screen.getByTestId('officer-sample-pres')).toBeTruthy());
    expect(screen.getByTestId('officer-sample-pres').props.accessibilityLabel).toBe(
      'Sample President, President',
    );
    await press(screen.getByTestId('officer-sample-pres'));
    expect(r.getPathname()).toBe('/chapter/member/sample-pres');
  });

  it('hides the officers row when nobody has a role', async () => {
    directory.resetDirectoryMock([directory.sampleEntry()]);
    await openChapter();
    expect(screen.queryByRole('header', { name: 'OFFICERS' })).toBeNull();
  });

  it('says so when there are no programs, and copes with a failed load', async () => {
    programs.failProgramsLoad();
    directory.failDirectoryLoad();
    await openChapter();
    await waitFor(() =>
      expect(screen.getByTestId('progress-line')).toHaveTextContent('No programs yet'),
    );
    expect(screen.getByTestId('directory-entry')).toBeTruthy();
  });
});

describe('officers', () => {
  it('shows the leadership card at the top with what is waiting', async () => {
    signIn({ role: 'officer', title: 'Secretary' });
    leadership.setMockWaiting({ membershipRequests: 2, openReports: 1 });
    await openChapter();
    await waitFor(() =>
      expect(screen.getByTestId('leadership-waiting')).toHaveTextContent(
        '2 membership requests · 1 report',
      ),
    );
    expect(screen.getByTestId('leadership-badge')).toHaveTextContent('3');
    expect(screen.getByTestId('leadership-entry').props.accessibilityLabel).toBe(
      'Leadership tools, Secretary, 2 membership requests · 1 report',
    );
  });

  it('shows no badge when nothing is waiting', async () => {
    signIn({ role: 'admin' });
    await openChapter();
    await waitFor(() =>
      expect(screen.getByTestId('leadership-waiting')).toHaveTextContent('Nothing waiting'),
    );
    expect(screen.queryByTestId('leadership-badge')).toBeNull();
  });

  it('falls back to their title if counts cannot load', async () => {
    signIn({ role: 'officer', title: 'Treasurer' });
    leadership.failWaitingLoad();
    await openChapter();
    await waitFor(() => expect(leadership.fetchWaitingCounts).toHaveBeenCalled());
    expect(screen.getByTestId('leadership-waiting')).toHaveTextContent('Signed in as Treasurer');
  });

  it('opens leadership', async () => {
    signIn({ role: 'officer', title: 'Treasurer' });
    const r = await openChapter();
    await press(screen.getByTestId('leadership-entry'));
    expect(r.getPathname()).toBe('/chapter/leadership');
  });
});
