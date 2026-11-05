import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { palette } from '@/theme';

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
jest.mock('@/data/attendance');
jest.mock('@/data/moderation');
const leadership =
  jest.requireMock<typeof import('@/data/__mocks__/leadership')>('@/data/leadership');

const DAY = 86_400_000;
const from = (days: number) => new Date(Date.now() + days * DAY);
const steps = (done: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({
    id: `m${i}`,
    name: `Step ${i}`,
    order: i,
    done: i < done,
  }));

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
  // Halfway through the chapter year.
  const k = leadership.sampleCurrentKpis();
  k.periods.year = leadership.sampleKpis({
    period: '2026-27',
    label: '2026-27 chapter year',
    start: from(-100),
    end: from(100),
  });
  leadership.setMockKpis(k);
  programs.resetProgramsMock([
    programs.sampleProgram({
      id: 'ok',
      name: 'Sample mentoring',
      createdAt: from(-10),
      dueAt: from(10),
      milestones: steps(1, 2),
    }),
    programs.sampleProgram({ id: 'late', name: 'Sample food drive', dueAt: from(-2) }),
    programs.sampleProgram({ id: 'done', name: 'Sample orientation', milestones: steps(3, 3) }),
    programs.sampleProgram({ id: 'help', name: 'Sample health week', status: 'at_risk' }),
  ]);
});

async function openHealth() {
  const r = await renderRouter('src/app', { initialUrl: '/chapter/health' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  return r;
}

const status = (kind: 'program' | 'goal', id: string) =>
  screen.getByTestId(`health-${kind}-${id}-status`);

it('shows the year at a glance: green, yellow and red counts and the totals', async () => {
  await openHealth();
  expect(screen.getByRole('header', { name: 'Chapter health' })).toBeTruthy();
  expect(screen.getByText('2026-27 chapter year')).toBeTruthy();
  // Programs: mentoring and orientation green, food drive and health week red.
  // Goals: service hours behind (yellow), participation met (green).
  expect(screen.getByTestId('health-count-green')).toHaveTextContent('3 on track');
  expect(screen.getByTestId('health-count-yellow')).toHaveTextContent('1 behind');
  expect(screen.getByTestId('health-count-red')).toHaveTextContent('2 at risk');
  expect(screen.getByTestId('health-summary').props.accessibilityLabel).toBe(
    'Overall, 3 on track · 1 behind · 2 at risk',
  );
  const segment = (h: string) =>
    StyleSheet.flatten(
      screen.getByTestId(`health-bar-${h}`, { includeHiddenElements: true }).props.style,
    );
  expect(segment('green')).toMatchObject({ flex: 3, backgroundColor: palette.healthGreen });
  expect(segment('red')).toMatchObject({ flex: 2, backgroundColor: palette.destructive });
  expect(screen.getByTestId('health-year')).toHaveTextContent('50%');
  expect(screen.getByTestId('health-goals-met')).toHaveTextContent('1 of 2');
});

it('lists programs worst first, each with its status and why', async () => {
  await openHealth();
  const order = screen
    .queryAllByTestId(/^health-program-[a-z]+$/)
    .map((r) => String(r.props.testID).replace('health-program-', ''));
  expect(order).toEqual(['late', 'help', 'ok', 'done']);
  expect(status('program', 'late')).toHaveTextContent('At risk');
  expect(screen.getByTestId('health-program-late').props.accessibilityLabel).toBe(
    'Sample food drive, At risk, 50 percent done, Past its due date',
  );
  expect(screen.getByTestId('health-program-help').props.accessibilityLabel).toMatch(
    /Flagged as needing help$/,
  );
  expect(status('program', 'ok')).toHaveTextContent('On track');
  expect(status('program', 'done')).toHaveTextContent('Done');
});

it('opens a program', async () => {
  const r = await openHealth();
  await press(screen.getByTestId('health-program-late'));
  expect(r.getPathname()).toBe('/chapter/programs/late');
});

it('shows each goal against the pace of the year', async () => {
  await openHealth();
  expect(status('goal', 'g1')).toHaveTextContent('Behind');
  expect(screen.getByTestId('health-goal-g1').props.accessibilityLabel).toBe(
    'Sample service hours, Behind, 210 of 500 hours, Expected 250 hours by now',
  );
  expect(status('goal', 'g2')).toHaveTextContent('Met');
  expect(screen.getByTestId('health-key')).toHaveTextContent(/not national requirements/);
});

it('says so when there are no programs or numbers yet', async () => {
  programs.resetProgramsMock([]);
  leadership.setMockKpis(null);
  await openHealth();
  expect(screen.getByTestId('health-no-programs')).toBeTruthy();
  expect(screen.getByTestId('health-no-goals')).toBeTruthy();
  expect(screen.getByTestId('health-year')).toHaveTextContent('–');
  expect(screen.getByTestId('health-summary').props.accessibilityLabel).toBe(
    'Overall, Nothing to track yet',
  );
});

it('offers Try again when it can’t load', async () => {
  programs.failProgramsLoad();
  await openHealth();
  await press(screen.getByTestId('health-retry'));
  await waitFor(() => expect(screen.getByTestId('health-summary')).toBeTruthy());
});

it('members can’t see it', async () => {
  signIn(null);
  await renderRouter('src/app', { initialUrl: '/chapter/health' });
  await waitFor(() => expect(screen.getByTestId('health-denied')).toBeTruthy());
  expect(programs.fetchPrograms).not.toHaveBeenCalled();
  expect(leadership.fetchKpis).not.toHaveBeenCalled();
});
