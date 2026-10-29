/* global jest */
// Global test setup for app unit tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The system "new event" sheet is native. Tests set what the person did with it.
jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved', id: 'device-event' })),
}));

// Push is native. Tests that care set what the device says; app tests never save tokens.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[test]' })),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/data/push');
