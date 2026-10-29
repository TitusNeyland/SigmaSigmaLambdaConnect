/* global jest */
// Global test setup for app unit tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The system "new event" sheet is native. Tests set what the person did with it.
jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved', id: 'device-event' })),
}));
