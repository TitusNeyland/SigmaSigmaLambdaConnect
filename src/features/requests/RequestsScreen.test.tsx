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
jest.mock('@/data/requests');
const requests = jest.requireMock<typeof import('@/data/__mocks__/requests')>('@/data/requests');

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

const JORDAN = requests.sampleRequest();
const TAYLOR = requests.sampleRequest({
  uid: 'sample-taylor',
  displayName: 'Sample Taylor',
  initiationTerm: 'Fall 2015',
  requestedAt: new Date(Date.now() - 5 * 3600_000),
});

beforeEach(() => {
  signIn({ role: 'officer', title: 'Membership Chair' });
  requests.resetRequestsMock([JORDAN, TAYLOR]);
});

async function openRequests() {
  const r = await renderRouter('src/app', { initialUrl: '/chapter/requests' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  return r;
}

it('lists pending requests with name, initiation term and when they asked', async () => {
  await openRequests();
  expect(screen.getByRole('header', { name: 'Membership requests' })).toBeTruthy();
  const row = screen.getByTestId('request-sample-jordan');
  expect(row).toHaveTextContent(/Sample Jordan/);
  expect(row).toHaveTextContent(/Initiated Spring 2024 · Asked 2d/);
  expect(screen.getByTestId('request-sample-taylor')).toHaveTextContent(
    /Initiated Fall 2015 · Asked 5h/,
  );
});

it('approves inline and records who decided', async () => {
  await openRequests();
  await press(screen.getByRole('button', { name: 'Approve Sample Jordan' }));
  expect(requests.decideRequest).toHaveBeenCalledWith(
    'sample-jordan',
    auth.sampleUser().uid,
    'approved',
  );
  expect(screen.getByTestId('request-done-sample-jordan')).toHaveTextContent(
    'Approved. Sample Jordan is in.',
  );
  expect(screen.queryByTestId('approve-sample-jordan')).toBeNull();
  expect(screen.getByTestId('approve-sample-taylor')).toBeTruthy();
});

it('asks before declining, and can be cancelled', async () => {
  await openRequests();
  await press(screen.getByTestId('decline-sample-taylor'));
  expect(requests.decideRequest).not.toHaveBeenCalled();
  expect(screen.getByText('Decline Sample Taylor? They won’t get into the app.')).toBeTruthy();
  await press(screen.getByTestId('decline-cancel-sample-taylor'));
  expect(screen.getByTestId('approve-sample-taylor')).toBeTruthy();

  await press(screen.getByTestId('decline-sample-taylor'));
  await press(screen.getByTestId('decline-confirm-sample-taylor'));
  expect(requests.decideRequest).toHaveBeenCalledWith(
    'sample-taylor',
    auth.sampleUser().uid,
    'declined',
  );
  expect(screen.getByTestId('request-done-sample-taylor')).toHaveTextContent('Declined');
});

it('says so when saving fails, and lets you try again', async () => {
  await openRequests();
  requests.failNextDecision();
  await press(screen.getByTestId('approve-sample-jordan'));
  expect(screen.getByTestId('request-failed-sample-jordan')).toHaveTextContent(
    'Couldn’t save that. Try again.',
  );
  await press(screen.getByTestId('approve-sample-jordan'));
  expect(screen.getByTestId('request-done-sample-jordan')).toBeTruthy();
});

it('shows an empty state', async () => {
  requests.resetRequestsMock([]);
  await openRequests();
  expect(screen.getByTestId('requests-empty')).toHaveTextContent(/^No one is waiting\./);
});

it('offers a retry when requests cannot load', async () => {
  requests.failRequestsLoad();
  await openRequests();
  await press(screen.getByTestId('requests-retry'));
  await waitFor(() => expect(screen.getByTestId('request-sample-jordan')).toBeTruthy());
});

it('is officers only and loads nothing for members', async () => {
  signIn(null);
  await renderRouter('src/app', { initialUrl: '/chapter/requests' });
  await waitFor(() => expect(screen.getByTestId('requests-denied')).toBeTruthy());
  expect(requests.fetchPendingRequests).not.toHaveBeenCalled();
});
