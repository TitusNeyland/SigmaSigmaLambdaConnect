import { signOutHere } from './signOut';

jest.mock('@/data/auth');
const auth = jest.requireMock<typeof import('@/data/__mocks__/auth')>('@/data/auth');
jest.mock('@/features/notifications/registerForPush', () => ({
  unregisterPush: jest.fn(async () => {}),
}));
const { unregisterPush } = jest.requireMock<
  typeof import('@/features/notifications/registerForPush')
>('@/features/notifications/registerForPush');

it('forgets this phone’s push token before signing out', async () => {
  auth.resetAuthMock();
  await signOutHere();
  expect(unregisterPush).toHaveBeenCalled();
  expect(auth.signOut).toHaveBeenCalled();
  expect(jest.mocked(unregisterPush).mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(auth.signOut).mock.invocationCallOrder[0],
  );
});
