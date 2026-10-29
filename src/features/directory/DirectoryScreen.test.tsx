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
const directory = jest.requireMock<typeof import('@/data/__mocks__/directory')>('@/data/directory');

const THIS_YEAR = new Date().getFullYear();

const BROTHERS = [
  directory.sampleEntry({
    uid: 'reed',
    displayName: 'Marcus Reed',
    headline: 'Software engineer',
    interests: ['Career mentoring'],
    role: { role: 'officer', title: 'Treasurer' },
  }),
  directory.sampleEntry({
    uid: 'baptiste',
    displayName: 'Chris Baptiste',
    headline: 'Nurse',
    initiationTerm: `Spring ${THIS_YEAR}`,
    interests: ['Golf'],
  }),
  directory.sampleEntry({
    uid: 'allen',
    displayName: 'Zed Allen',
    headline: 'Teacher',
    initiationTerm: 'Fall 2001',
    interests: [],
  }),
];

async function type(text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText('Search name, job or interest'), text);
  });
}

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(target);
  });
}

beforeEach(() => {
  auth.resetAuthMock();
  members.resetMembersMock();
  roles.resetRolesMock(null);
  directory.resetDirectoryMock(BROTHERS);
  auth.setMockUser(auth.sampleUser());
});

async function openDirectory() {
  await renderRouter('src/app', { initialUrl: '/chapter/directory' });
  await waitFor(() => expect(screen.getByTestId('member-reed')).toBeTruthy());
}

const shown = () =>
  screen.queryAllByTestId(/^member-/).map((row) => row.props.testID.replace('member-', ''));

it('is reachable from the Chapter tab', async () => {
  await renderRouter('src/app', { initialUrl: '/chapter' });
  await waitFor(() => expect(screen.getByTestId('directory-entry')).toBeTruthy());
  await press(screen.getByTestId('directory-entry'));
  await waitFor(() => expect(screen).toHavePathname('/chapter/directory'));
  expect(screen.getByRole('header', { name: 'Directory' })).toBeTruthy();
});

it('lists brothers A to Z by last name under letter headers, with role badges', async () => {
  await openDirectory();
  expect(shown()).toEqual(['allen', 'baptiste', 'reed']);
  for (const letter of ['A', 'B', 'R']) {
    expect(screen.getByRole('header', { name: letter })).toBeTruthy();
  }
  expect(screen.getByTestId('role-reed')).toHaveTextContent('Treasurer');
  expect(screen.queryByTestId('role-baptiste')).toBeNull();
  expect(screen.getByText('Software engineer · Initiated Spring 2019')).toBeTruthy();
});

it('searches live across name, headline and interests', async () => {
  await openDirectory();
  await type('nurse');
  expect(shown()).toEqual(['baptiste']);
  await type('golf');
  expect(shown()).toEqual(['baptiste']);
  await type('allen');
  expect(shown()).toEqual(['allen']);
  await press(screen.getByRole('button', { name: 'Clear search' }));
  expect(shown()).toEqual(['allen', 'baptiste', 'reed']);
});

it.each([
  ['Officers', ['reed']],
  ['Mentors', ['reed']],
  ['Recent initiates', ['baptiste']],
  ['All', ['allen', 'baptiste', 'reed']],
])('the %s filter shows the right brothers', async (label, expected) => {
  await openDirectory();
  await press(screen.getByRole('button', { name: label }));
  expect(shown()).toEqual(expected);
});

it('shows an empty state when nothing matches', async () => {
  await openDirectory();
  await press(screen.getByRole('button', { name: 'Officers' }));
  await type('teacher');
  expect(screen.getByTestId('directory-empty')).toBeTruthy();
  expect(screen.getByText('No officers match.')).toBeTruthy();
});

it('opens a brother’s profile', async () => {
  await openDirectory();
  await press(screen.getByTestId('member-baptiste'));
  await waitFor(() => expect(screen).toHavePathname('/chapter/member/baptiste'));
});

it('offers a retry when the directory can’t load', async () => {
  directory.failDirectoryLoad();
  await renderRouter('src/app', { initialUrl: '/chapter/directory' });
  await waitFor(() => expect(screen.getByText('Couldn’t load the directory.')).toBeTruthy());
  await press(screen.getByTestId('directory-retry'));
  await waitFor(() => expect(screen.getByTestId('member-reed')).toBeTruthy());
  expect(directory.fetchDirectory).toHaveBeenCalledTimes(2);
});

it('goes back to the Chapter tab', async () => {
  await renderRouter('src/app', { initialUrl: '/chapter/directory' });
  await waitFor(() => expect(screen.getByTestId('directory-back')).toBeTruthy());
  await press(screen.getByTestId('directory-back'));
  await waitFor(() => expect(screen).toHavePathname('/chapter'));
});
