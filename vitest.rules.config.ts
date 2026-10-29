import { defineConfig } from 'vitest/config';

/**
 * Security rules and Cloud Functions tests. They need the Firestore, Storage and Auth
 * emulators running, so start them with `npm run test:rules`, which wraps this in
 * `firebase emulators:exec`.
 */
export default defineConfig({
  test: {
    include: [
      'tests/rules/**/*.test.ts',
      'tests/**/*.emulator.test.ts',
      'functions/src/**/*.emulator.test.ts',
    ],
    environment: 'node',
    // All files share one emulator, so run them one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
