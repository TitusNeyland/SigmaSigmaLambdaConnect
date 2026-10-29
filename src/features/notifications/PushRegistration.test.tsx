import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

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
jest.mock('./registerForPush', () => ({
  registerForPush: jest.fn(async () => 'registered'),
  unregisterPush: jest.fn(async () => {}),
}));
const { registerForPush } =
  jest.requireMock<typeof import('./registerForPush')>('./registerForPush');

beforeEach(() => {
  jest.clearAllMocks();
  auth.resetAuthMock();
});

it('does not ask at first launch, before anyone signs in', async () => {
  members.resetMembersMock();
  await renderRouter('src/app', { initialUrl: '/' });
  await waitFor(() => expect(screen).toHavePathname('/welcome'));
  expect(registerForPush).not.toHaveBeenCalled();
});

it('registers a pending member, so they hear when they are approved', async () => {
  members.resetMembersMock(members.sampleMember({ status: 'pending' }));
  auth.setMockUser(auth.sampleUser());
  await renderRouter('src/app', { initialUrl: '/' });
  await waitFor(() => expect(screen).toHavePathname('/pending'));
  expect(registerForPush).toHaveBeenCalledWith(auth.sampleUser().uid);
});

it('registers an approved member once', async () => {
  members.resetMembersMock(members.sampleMember({ status: 'approved' }));
  auth.setMockUser(auth.sampleUser());
  await renderRouter('src/app', { initialUrl: '/' });
  await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));
});

it('does not register someone who still has to verify their email', async () => {
  members.resetMembersMock();
  auth.setMockUser(auth.sampleUser({ emailVerified: false }));
  await renderRouter('src/app', { initialUrl: '/' });
  await waitFor(() => expect(screen).toHavePathname('/verify-email'));
  expect(registerForPush).not.toHaveBeenCalled();
});
