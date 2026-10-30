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
const programs = jest.requireMock<typeof import('@/data/__mocks__/programs')>('@/data/programs');
jest.mock('@/data/announcements');
jest.mock('@/data/leadership');
jest.mock('@/data/requests');
const requests = jest.requireMock<typeof import('@/data/__mocks__/requests')>('@/data/requests');
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
  signIn({ role: 'officer', title: 'Secretary' });
  leadership.resetLeadershipMock();
  requests.resetRequestsMock();
  leadership.setMockKpis(leadership.sampleCurrentKpis());
  programs.resetProgramsMock([
    programs.sampleProgram(),
    programs.sampleProgram({ id: 'sample-drive', name: 'Sample book drive', status: 'at_risk' }),
  ]);
});

async function openLeadership() {
  const r = await renderRouter('src/app', { initialUrl: '/chapter/leadership' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  return r;
}

const value = (key: string) => screen.getByTestId(`kpi-${key}-value`);

describe('KPIs', () => {
  it('shows the goals ring and four KPI tiles for the semester', async () => {
    await openLeadership();
    expect(screen.getByRole('header', { name: 'Leadership' })).toBeTruthy();
    expect(screen.getByText('Signed in as Secretary')).toBeTruthy();
    expect(screen.getByTestId('goals-line')).toHaveTextContent('1 of 2 goals met');
    expect(screen.getByTestId('goals-ring').props.accessibilityLabel).toBe(
      '1 of 2 chapter goals met',
    );
    expect(screen.getByText(/not national requirements/)).toBeTruthy();
    expect(screen.getByTestId('goal-g1').props.accessibilityLabel).toBe(
      'Sample service hours, 210 of 500 hours',
    );
    expect(screen.getByTestId('goal-g2').props.accessibilityLabel).toBe(
      'Sample participation, 64% of 60%, met',
    );
    expect(value('participation')).toHaveTextContent('62%');
    expect(value('attendance')).toHaveTextContent('41%');
    expect(value('service')).toHaveTextContent('128.5');
    expect(value('active')).toHaveTextContent('31');
    expect(screen.getByTestId('kpis-updated')).toHaveTextContent('Fall 2026 · Updated 20 min ago');
  });

  it('switches period', async () => {
    await openLeadership();
    await press(screen.getByRole('tab', { name: 'Chapter year' }));
    expect(value('service')).toHaveTextContent('210');
    expect(screen.getByTestId('kpis-updated')).toHaveTextContent(/^2026-27 chapter year/);
    await press(screen.getByRole('tab', { name: '30 days' }));
    expect(value('participation')).toHaveTextContent('33%');
    expect(value('attendance')).toHaveTextContent('None');
    expect(screen.getByTestId('kpi-attendance').props.accessibilityLabel).toBe(
      'Attendance, None, No events yet',
    );
    await press(screen.getByRole('tab', { name: 'Semester' }));
    expect(value('participation')).toHaveTextContent('62%');
  });

  it('explains when the numbers have not been worked out yet', async () => {
    leadership.setMockKpis(null);
    await openLeadership();
    expect(screen.getByTestId('kpis-empty')).toHaveTextContent(/No numbers yet/);
    expect(screen.queryByTestId('goals-card')).toBeNull();
  });

  it('says when no goals are set', async () => {
    const k = leadership.sampleCurrentKpis();
    k.periods.semester = leadership.sampleKpis({ goals: [], goalsDone: 0, goalsTotal: 0 });
    leadership.setMockKpis(k);
    await openLeadership();
    expect(screen.getByTestId('goals-line')).toHaveTextContent('No goals set yet');
  });

  it('offers a retry when the numbers cannot load', async () => {
    leadership.failKpisLoad();
    await openLeadership();
    expect(screen.getByText('Couldn’t load the numbers.')).toBeTruthy();
    await press(screen.getByTestId('kpis-retry'));
    await waitFor(() => expect(screen.getByTestId('goals-card')).toBeTruthy());
    expect(leadership.fetchKpis).toHaveBeenCalledTimes(2);
  });
});

describe('needs attention', () => {
  it('lists requests, reports and programs at risk', async () => {
    requests.resetRequestsMock([requests.sampleRequest()]);
    leadership.setMockWaiting({ membershipRequests: 1, openReports: 1 });
    await openLeadership();
    await waitFor(() => expect(screen.getByTestId('request-sample-jordan')).toBeTruthy());
    expect(screen.queryByTestId('attention-requests')).toBeNull();
    expect(screen.getByTestId('reports-count')).toHaveTextContent('1');
    expect(screen.getByTestId('attention-program-sample-drive')).toBeTruthy();
    expect(screen.queryByTestId('attention-program-sample-scholarship')).toBeNull();
    expect(screen.queryByTestId('attention-none')).toBeNull();
  });

  it.each([
    ['attention-requests', '/chapter/requests'],
    ['attention-reports', '/chapter/reports'],
    ['attention-program-sample-drive', '/chapter/programs/sample-drive'],
  ])('%s opens %s', async (id, path) => {
    requests.resetRequestsMock(
      ['a', 'b', 'c', 'd'].map((x) => requests.sampleRequest({ uid: `sample-${x}` })),
    );
    leadership.setMockWaiting({ membershipRequests: 4, openReports: 1 });
    const r = await openLeadership();
    await waitFor(() => expect(screen.getByTestId(id)).toBeTruthy());
    await press(screen.getByTestId(id));
    expect(r.getPathname()).toBe(path);
  });

  it('says when nothing needs attention', async () => {
    programs.resetProgramsMock([programs.sampleProgram()]);
    await openLeadership();
    await waitFor(() => expect(screen.getByTestId('attention-none')).toBeTruthy());
  });
});

describe('membership requests inline (#48)', () => {
  it('shows the first three with approve and decline, and links to the rest', async () => {
    requests.resetRequestsMock(
      ['a', 'b', 'c', 'd'].map((x) =>
        requests.sampleRequest({ uid: `sample-${x}`, displayName: `Sample ${x.toUpperCase()}` }),
      ),
    );
    await openLeadership();
    await waitFor(() => expect(screen.getByTestId('request-sample-a')).toBeTruthy());
    expect(screen.getByTestId('request-sample-c')).toBeTruthy();
    expect(screen.queryByTestId('request-sample-d')).toBeNull();
    expect(screen.getByTestId('requests-count')).toHaveTextContent('4');

    await press(screen.getByTestId('approve-sample-a'));
    expect(requests.decideRequest).toHaveBeenCalledWith(
      'sample-a',
      auth.sampleUser().uid,
      'approved',
    );
    expect(screen.getByTestId('request-done-sample-a')).toHaveTextContent(
      'Approved. Sample A is in.',
    );
  });
});

describe('quick actions', () => {
  it.each([
    ['action-attendance', '/chapter/attendance'],
    ['action-announce', '/chapter/announcements/new'],
    ['action-event', '/events/new'],
    ['action-milestone', '/chapter/progress'],
  ])('%s opens %s', async (id, path) => {
    const r = await openLeadership();
    await press(screen.getByTestId(id));
    expect(r.getPathname()).toBe(path);
  });
});

describe('access', () => {
  it('is officers only, even by direct link, and loads nothing for members', async () => {
    signIn(null);
    await renderRouter('src/app', { initialUrl: '/chapter/leadership' });
    await waitFor(() => expect(screen.getByTestId('leadership-denied')).toBeTruthy());
    expect(screen.queryByTestId('quick-actions')).toBeNull();
    expect(leadership.fetchKpis).not.toHaveBeenCalled();
    expect(leadership.fetchWaitingCounts).not.toHaveBeenCalled();
  });

  it('fails closed when the role cannot load', async () => {
    signIn({ role: 'admin' });
    roles.failNextRoleLoad();
    await renderRouter('src/app', { initialUrl: '/chapter/leadership' });
    await waitFor(() => expect(screen.getByTestId('leadership-denied')).toBeTruthy());
  });

  it('opens from the Chapter hub card', async () => {
    const r = await renderRouter('src/app', { initialUrl: '/chapter' });
    await waitFor(() => expect(screen.getByTestId('leadership-entry')).toBeTruthy());
    await press(screen.getByTestId('leadership-entry'));
    expect(r.getPathname()).toBe('/chapter/leadership');
    await waitFor(() => expect(screen.getByTestId('goals-card')).toBeTruthy());
  });
});
