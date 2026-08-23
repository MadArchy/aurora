import { defineConfig } from 'vitest/config';

/** Isolated config: default vitest.config excludes rules tests from `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/firestore.rules.test.ts', 'tests/storage.rules.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
