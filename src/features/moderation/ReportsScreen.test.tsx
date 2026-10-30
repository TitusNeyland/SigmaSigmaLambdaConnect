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
const leadership =
  jest.requireMock<typeof import('@/data/__mocks__/leadership')>('@/data/leadership');
jest.mock('@/data/requests');
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
const mod = jest.requireMock<typeof import('@/data/__mocks__/moderation')>('@/data/moderation');

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

const POST = mod.sampleCase();
const MEMBER = mod.sampleCase({
  key: 'member_sample-rude',
  targetType: 'member',
  postId: null,
  authorId: 'sample-rude',
  authorName: 'Sample Rude',
  preview: null,
  reasons: [{ reason: 'harassment', count: 1 }],
  details: [],
  count: 1,
  reportIds: ['m1'],
});
const GONE = mod.sampleCase({
  key: 'comment_p_c',
  targetType: 'comment',
  commentId: 'c',
  preview: null,
  count: 1,
  reportIds: ['c1'],
});

beforeEach(() => {
  signIn({ role: 'officer', title: 'Secretary' });
  mod.resetModerationMock();
  mod.setMockCases([POST, MEMBER, GONE]);
});

async function openReports() {
  const r = await renderRouter('src/app', { initialUrl: '/chapter/reports' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  return r;
}

describe('report cards', () => {
  it('show the kind, count, author, preview and reasons, without naming reporters', async () => {
    await openReports();
    expect(screen.getByRole('header', { name: 'Reports' })).toBeTruthy();
    const card = screen.getByTestId(`case-${POST.key}`);
    expect(screen.getByTestId(`case-count-${POST.key}`)).toHaveTextContent('3 reports');
    expect(card).toHaveTextContent(/Posted by Sample Author/);
    expect(screen.getByTestId(`case-preview-${POST.key}`)).toHaveTextContent(
      /Sample reported caption/,
    );
    expect(screen.getByTestId(`case-reasons-${POST.key}`)).toHaveTextContent(/Spam ×2/);
    expect(screen.getByTestId(`case-reasons-${POST.key}`)).toHaveTextContent(
      /Harassment or bullying/,
    );
    expect(card).toHaveTextContent(/“Sample detail from a reporter”/);
    expect(screen.getByText(/Reporters stay anonymous/)).toBeTruthy();
  });

  it('a member report has no preview and no Remove', async () => {
    await openReports();
    expect(screen.getByTestId(`case-${MEMBER.key}`)).toHaveTextContent(/Sample Rude was reported/);
    expect(screen.queryByTestId(`case-preview-${MEMBER.key}`)).toBeNull();
    expect(screen.queryByTestId(`case-removed-${MEMBER.key}`)).toBeNull();
    expect(screen.getByTestId(`case-restricted-${MEMBER.key}`).props.accessibilityLabel).toBe(
      'Restrict Sample Rude for 7 days',
    );
  });

  it('says when the reported content is already gone', async () => {
    await openReports();
    expect(screen.getByTestId(`case-gone-${GONE.key}`)).toHaveTextContent(
      'This was already deleted.',
    );
  });
});

describe('deciding', () => {
  it.each([
    ['kept', 'Kept. Reporters were told.'],
    ['removed', 'Post removed. Reporters were told.'],
    ['restricted', 'Sample Author can’t post or comment for 7 days. Reporters were told.'],
  ] as const)('%s acts on every report in the card', async (action, text) => {
    await openReports();
    await press(screen.getByTestId(`case-${action}-${POST.key}`));
    expect(mod.resolveReportCase).toHaveBeenCalledWith(['r1', 'r2', 'r3'], action);
    expect(screen.getByTestId(`case-done-${POST.key}`)).toHaveTextContent(text);
  });

  it('undo reverses the decision and brings the card back', async () => {
    await openReports();
    await press(screen.getByTestId(`case-removed-${POST.key}`));
    await press(screen.getByTestId(`case-undo-${POST.key}`));
    expect(mod.undoReportDecision).toHaveBeenCalledWith('decision-1');
    expect(screen.queryByTestId(`case-done-${POST.key}`)).toBeNull();
    expect(screen.getByTestId(`case-kept-${POST.key}`)).toBeTruthy();
  });

  it('shows an error if the decision fails, and keeps the card open', async () => {
    await openReports();
    mod.failNextAction();
    await press(screen.getByTestId(`case-kept-${POST.key}`));
    expect(screen.getByTestId(`case-failed-${POST.key}`)).toHaveTextContent(
      'Couldn’t save that. Try again.',
    );
    expect(screen.getByTestId(`case-kept-${POST.key}`)).toBeTruthy();
  });

  it('keeps the decision if undo fails', async () => {
    await openReports();
    await press(screen.getByTestId(`case-kept-${POST.key}`));
    mod.failNextAction();
    await press(screen.getByTestId(`case-undo-${POST.key}`));
    expect(screen.getByTestId(`case-done-${POST.key}`)).toBeTruthy();
    expect(screen.getByText('Couldn’t undo. Try again.')).toBeTruthy();
  });
});

describe('states and access', () => {
  it('shows an empty queue', async () => {
    mod.setMockCases([]);
    await openReports();
    expect(screen.getByTestId('reports-empty')).toHaveTextContent('No open reports.');
  });

  it('retries a failed load', async () => {
    mod.failQueueLoad();
    await openReports();
    await press(screen.getByTestId('reports-retry'));
    await waitFor(() => expect(screen.getByTestId(`case-${POST.key}`)).toBeTruthy());
  });

  it('is officers only and loads nothing for members', async () => {
    signIn(null);
    await renderRouter('src/app', { initialUrl: '/chapter/reports' });
    await waitFor(() => expect(screen.getByTestId('reports-denied')).toBeTruthy());
    expect(mod.fetchReportQueue).not.toHaveBeenCalled();
  });

  it('opens from Needs attention on the leadership home', async () => {
    leadership.setMockWaiting({ membershipRequests: 0, openReports: 3 });
    const r = await renderRouter('src/app', { initialUrl: '/chapter/leadership' });
    await waitFor(() => expect(screen.getByTestId('attention-reports')).toBeTruthy());
    await press(screen.getByTestId('attention-reports'));
    expect(r.getPathname()).toBe('/chapter/reports');
    await waitFor(() => expect(screen.getByTestId(`case-${POST.key}`)).toBeTruthy());
  });
});
