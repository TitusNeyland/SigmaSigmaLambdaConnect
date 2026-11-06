/** Unit tests for app code. Security rules tests run separately with Vitest (npm run test:rules). */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Reanimated and worklets load their JS versions in tests (the photo editor's pinch and drag).
  resolver: 'react-native-reanimated/jest/resolver',
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/', '<rootDir>/functions/'],
  // Screen tests render the whole route tree; the first one in a file is slow on CI runners.
  testTimeout: 20000,
};
