import { defineConfig } from 'vitest/config';

/** Isolated config: default vitest.config excludes rules tests from `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/firestore.rules.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
