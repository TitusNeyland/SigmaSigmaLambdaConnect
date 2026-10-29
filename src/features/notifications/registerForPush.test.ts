import * as Device from 'expo-device';
import {
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { registerForPush, resetPushRegistration, unregisterPush } from './registerForPush';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
}));
const push = jest.requireMock<typeof import('@/data/__mocks__/push')>('@/data/push');

const device = Device as { isDevice: boolean };
const permission = (granted: boolean, canAskAgain = true) =>
  ({ granted, canAskAgain, status: granted ? 'granted' : 'undetermined' }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  push.resetPushMock();
  resetPushRegistration();
  device.isDevice = true;
  Platform.OS = 'ios';
  jest.mocked(getPermissionsAsync).mockResolvedValue(permission(false));
  jest.mocked(requestPermissionsAsync).mockResolvedValue(permission(true));
  jest
    .mocked(getExpoPushTokenAsync)
    .mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[abc]' });
});

it('asks once, then saves the token for the member', async () => {
  expect(await registerForPush('me')).toBe('registered');
  expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project' });
  expect(push.savePushToken).toHaveBeenCalledWith('me', 'ExponentPushToken[abc]', 'ios');
});

it('does not ask again when permission was already granted', async () => {
  jest.mocked(getPermissionsAsync).mockResolvedValue(permission(true));
  expect(await registerForPush('me')).toBe('registered');
  expect(requestPermissionsAsync).not.toHaveBeenCalled();
});

it('respects a no, and never nags when the system won’t ask again', async () => {
  jest.mocked(requestPermissionsAsync).mockResolvedValue(permission(false));
  expect(await registerForPush('me')).toBe('denied');
  expect(push.savePushToken).not.toHaveBeenCalled();

  jest.clearAllMocks();
  jest.mocked(getPermissionsAsync).mockResolvedValue(permission(false, false));
  expect(await registerForPush('me')).toBe('denied');
  expect(requestPermissionsAsync).not.toHaveBeenCalled();
});

it('creates the Android channel before asking', async () => {
  Platform.OS = 'android';
  expect(await registerForPush('me')).toBe('registered');
  expect(setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.any(Object));
  const channelOrder = jest.mocked(setNotificationChannelAsync).mock.invocationCallOrder[0];
  const askOrder = jest.mocked(requestPermissionsAsync).mock.invocationCallOrder[0];
  expect(channelOrder).toBeLessThan(askOrder);
  expect(push.savePushToken).toHaveBeenCalledWith('me', 'ExponentPushToken[abc]', 'android');
});

it('skips simulators and web without asking', async () => {
  device.isDevice = false;
  expect(await registerForPush('me')).toBe('unsupported');
  Platform.OS = 'web';
  device.isDevice = true;
  expect(await registerForPush('me')).toBe('unsupported');
  expect(getPermissionsAsync).not.toHaveBeenCalled();
});

it('reports a failure instead of throwing', async () => {
  push.savePushToken.mockRejectedValueOnce(new Error('offline'));
  expect(await registerForPush('me')).toBe('failed');
});

it('forgets this phone’s token on sign out, once', async () => {
  await registerForPush('me');
  await unregisterPush();
  expect(push.removePushToken).toHaveBeenCalledWith('me', 'ExponentPushToken[abc]');
  await unregisterPush();
  expect(push.removePushToken).toHaveBeenCalledTimes(1);
});

it('signing out never fails because the token could not be removed', async () => {
  await registerForPush('me');
  push.removePushToken.mockRejectedValueOnce(new Error('offline'));
  await expect(unregisterPush()).resolves.toBeUndefined();
});
