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
jest.mock('@/data/likes');
jest.mock('@/data/posts');
jest.mock('@/data/comments');
jest.mock('@/data/programs');
const programs = jest.requireMock<typeof import('@/data/__mocks__/programs')>('@/data/programs');

const m = (id: string, name: string, done: boolean, order: number) => ({ id, name, done, order });
const PROGRAMS = [
  programs.sampleProgram({
    id: 'health',
    name: 'Sample health week',
    status: 'at_risk',
    ownerTitle: 'Health committee',
    milestones: [m('h1', 'Secure venue', true, 1), m('h2', 'Confirm speakers', false, 2)],
  }),
  programs.sampleProgram({
    id: 'scholarship',
    name: 'Sample scholarship',
    status: 'in_progress',
    milestones: [
      m('s1', 'Committee', true, 1),
      m('s2', 'Applications', true, 2),
      m('s3', 'Report', false, 3),
      m('s4', 'Awards', false, 4),
    ],
  }),
  programs.sampleProgram({
    id: 'orientation',
    name: 'Sample orientation',
    status: 'completed',
    milestones: [m('o1', 'Packet', true, 1)],
  }),
];

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  programs.resetProgramsMock(PROGRAMS);
  auth.setMockUser(auth.sampleUser());
});

async function openProgress() {
  await renderRouter('src/app', { initialUrl: '/chapter/progress' });
  await waitFor(() => expect(screen.getByTestId('group-help')).toBeTruthy());
}

it('groups programs into needs help, on track and completed', async () => {
  await openProgress();
  const order = screen.getAllByTestId(/^group-/).map((g) => g.props.testID);
  expect(order).toEqual(['group-help', 'group-track', 'group-done']);
  expect(screen.getByRole('header', { name: 'NEEDS HELP' })).toBeTruthy();
});

it('sums up the chapter, and says goals are chapter-defined', async () => {
  await openProgress();
  // 4 of 7 milestones done.
  expect(screen.getByTestId('progress-ring').props.accessibilityLabel).toBe(
    'Chapter programs 57 percent done',
  );
  expect(screen.getByText('1 of 3 programs complete')).toBeTruthy();
  expect(
    screen.getByText('Goals the chapter set for this year, not national requirements.'),
  ).toBeTruthy();
});

it('expands a program to show its milestones, and collapses it', async () => {
  await openProgress();
  expect(screen.queryByTestId('milestones-scholarship')).toBeNull();
  await press(screen.getByTestId('program-toggle-scholarship'));
  expect(screen.getByTestId('milestones-scholarship')).toBeTruthy();
  expect(screen.getByLabelText('Report, not done')).toBeTruthy();
  expect(screen.getByTestId('program-toggle-scholarship').props.accessibilityState).toMatchObject({
    expanded: true,
  });
  await press(screen.getByTestId('program-toggle-scholarship'));
  expect(screen.queryByTestId('milestones-scholarship')).toBeNull();
});

it('opens a program from its milestones', async () => {
  await openProgress();
  await press(screen.getByTestId('program-toggle-health'));
  await press(screen.getByTestId('program-open-health'));
  await waitFor(() => expect(screen).toHavePathname('/chapter/programs/health'));
});

it('I can help only shows on programs that need help, and sends the offer', async () => {
  await openProgress();
  expect(screen.queryByTestId('help-scholarship')).toBeNull();
  await press(screen.getByTestId('help-health'));
  expect(programs.offerHelp).toHaveBeenCalledWith('health', auth.sampleUser().uid);
  expect(screen.getByTestId('helped-health')).toHaveTextContent(
    'Thanks for offering. Health committee will reach out.',
  );
});

it('remembers an earlier offer', async () => {
  programs.setMockOffers(['health']);
  await openProgress();
  expect(screen.getByTestId('helped-health')).toBeTruthy();
  expect(screen.queryByTestId('help-health')).toBeNull();
});

it('keeps the button and says so when the offer fails', async () => {
  programs.offerHelp.mockRejectedValueOnce(new Error('offline'));
  await openProgress();
  await press(screen.getByTestId('help-health'));
  await waitFor(() => expect(screen.getByText('Couldn’t send that. Try again.')).toBeTruthy());
  expect(screen.getByTestId('help-health')).toBeTruthy();
});

it('has an empty state and a retry', async () => {
  programs.resetProgramsMock([]);
  await renderRouter('src/app', { initialUrl: '/chapter/progress' });
  await waitFor(() => expect(screen.getByTestId('progress-empty')).toBeTruthy());

  programs.resetProgramsMock(PROGRAMS);
  programs.failProgramsLoad();
  await renderRouter('src/app', { initialUrl: '/chapter/progress' });
  await waitFor(() => expect(screen.getByText('Couldn’t load programs.')).toBeTruthy());
  await press(screen.getByTestId('progress-retry'));
  await waitFor(() => expect(screen.getByTestId('group-help')).toBeTruthy());
});
