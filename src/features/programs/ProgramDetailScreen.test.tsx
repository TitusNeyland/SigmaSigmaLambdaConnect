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
const programs = jest.requireMock<typeof import('@/data/__mocks__/programs')>('@/data/programs');

const PROGRAM = programs.sampleProgram({
  id: 'p1',
  name: 'Sample scholarship initiative',
  milestones: [
    { id: 'm1', name: 'Form committee', order: 1, done: true },
    { id: 'm2', name: 'Open applications', order: 2, done: true },
    { id: 'm3', name: 'Review applicants', order: 3, done: true },
    { id: 'm4', name: 'Final report', order: 4, done: false },
  ],
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
  programs.resetProgramsMock([PROGRAM]);
});

async function openProgram(id = 'p1') {
  await renderRouter('src/app', { initialUrl: `/chapter/programs/${id}` });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
}

it('shows the owner, due date, percent done and milestones', async () => {
  await openProgram();
  expect(screen.getByRole('header', { name: 'Sample scholarship initiative' })).toBeTruthy();
  expect(screen.getByText('Led by Director of Education')).toBeTruthy();
  expect(screen.getByTestId('program-status')).toHaveTextContent('On track');
  expect(screen.getByTestId('program-due')).toHaveTextContent(/^Due /);
  expect(screen.getByTestId('program-percent')).toHaveTextContent('75% done');
  expect(screen.getByText('3 of 4 milestones')).toBeTruthy();
});

it('members see milestones but can’t check them off', async () => {
  await openProgram();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByTestId('milestone-m4').props.accessibilityLabel).toBe(
    'Final report, not done',
  );
});

it('officers check off the last milestone, which completes the program', async () => {
  signIn({ role: 'officer', title: 'Director of Education' });
  await openProgram();
  await press(screen.getByRole('checkbox', { name: 'Final report' }));
  expect(programs.setMilestoneDone).toHaveBeenCalledWith(
    'p1',
    'm4',
    true,
    auth.sampleUser().uid,
    'completed',
  );
  expect(screen.getByTestId('program-percent')).toHaveTextContent('100% done');
  expect(screen.getByTestId('program-status')).toHaveTextContent('Completed');
  expect(
    screen.getByRole('checkbox', { name: 'Final report' }).props.accessibilityState,
  ).toMatchObject({
    checked: true,
  });
});

it('officers can uncheck one, and a failure puts it back', async () => {
  signIn({ role: 'officer' });
  programs.setMilestoneDone.mockRejectedValueOnce(new Error('offline'));
  await openProgram();
  await press(screen.getByRole('checkbox', { name: 'Form committee' }));
  await waitFor(() => expect(screen.getByTestId('milestone-error')).toBeTruthy());
  expect(screen.getByTestId('program-percent')).toHaveTextContent('75% done');
  await press(screen.getByRole('checkbox', { name: 'Form committee' }));
  expect(programs.setMilestoneDone).toHaveBeenLastCalledWith(
    'p1',
    'm1',
    false,
    auth.sampleUser().uid,
    'in_progress',
  );
  expect(screen.getByTestId('program-percent')).toHaveTextContent('50% done');
});

it('says when a program is gone, and retries a failed load', async () => {
  await openProgram('missing');
  expect(screen.getByText('This program isn’t available.')).toBeTruthy();
  programs.failProgramsLoad();
  await openProgram();
  expect(screen.getByText('Couldn’t load this program.')).toBeTruthy();
  await press(screen.getByTestId('program-retry'));
  await waitFor(() => expect(screen.getByTestId('program-percent')).toBeTruthy());
});
