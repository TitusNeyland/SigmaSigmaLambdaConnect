/** Unit tests for app code. Security rules tests run separately with Vitest (npm run test:rules). */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/', '<rootDir>/functions/'],
};
