import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/data/members');
const members = jest.requireMock<typeof import('@/data/__mocks__/members')>('@/data/members');
jest.mock('@/data/roles');
const roles = jest.requireMock<typeof import('@/data/__mocks__/roles')>('@/data/roles');
jest.mock('@/data/profile');
const profile = jest.requireMock<typeof import('@/data/__mocks__/profile')>('@/data/profile');
jest.mock('@/data/blocks');
jest.mock('@/data/account');
jest.mock('@/data/directory');
const blocks = jest.requireMock<typeof import('@/data/__mocks__/blocks')>('@/data/blocks');

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
  blocks.resetBlocksMock();
  auth.setMockUser(auth.sampleUser());
});

async function openBlocked() {
  await renderRouter('src/app', { initialUrl: '/profile/blocked' });
  await waitFor(() =>
    expect(screen.getByRole('header', { name: 'Blocked accounts' })).toBeTruthy(),
  );
}

it('explains how blocking works when no one is blocked', async () => {
  await openBlocked();
  expect(screen.getByText('No one is blocked')).toBeTruthy();
});

it('lists blocked people and unblocks one', async () => {
  blocks.resetBlocksMock([
    { uid: 'b', displayName: 'Brandon Lee', photoURL: null },
    { uid: 'c', displayName: 'Chris Baptiste', photoURL: null },
  ]);
  await openBlocked();
  expect(screen.getByText('Brandon Lee')).toBeTruthy();
  await press(screen.getByRole('button', { name: 'Unblock Brandon Lee' }));
  expect(blocks.unblock).toHaveBeenCalledWith(auth.sampleUser().uid, 'b');
  await waitFor(() => expect(screen.queryByText('Brandon Lee')).toBeNull());
  expect(screen.getByText('Chris Baptiste')).toBeTruthy();
});

it('keeps the person listed and says so if unblocking fails', async () => {
  blocks.resetBlocksMock([{ uid: 'b', displayName: 'Brandon Lee', photoURL: null }]);
  blocks.unblock.mockRejectedValueOnce(new Error('unavailable'));
  await openBlocked();
  await press(screen.getByRole('button', { name: 'Unblock Brandon Lee' }));
  await waitFor(() =>
    expect(screen.getByText('Couldn’t unblock Brandon Lee. Try again.')).toBeTruthy(),
  );
  expect(screen.getByText('Brandon Lee')).toBeTruthy();
});

it('shows a message if the list can’t load', async () => {
  blocks.failBlockedLoad();
  await openBlocked();
  expect(screen.getByText('Couldn’t load your blocked accounts.')).toBeTruthy();
});
