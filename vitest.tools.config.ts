import { defineConfig } from 'vitest/config';

/** Tests for repo tools (seed script) that don't need the emulators. Part of `npm test`. */
export default defineConfig({
  test: {
    include: ['tests/**/*.unit.test.ts', 'functions/src/**/*.unit.test.ts'],
    environment: 'node',
  },
});
