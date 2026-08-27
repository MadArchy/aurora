/**
 * SPEC-010 · Playwright E2E / parity harness foundation (T-010-104).
 *
 * Phase 1 proves only the foundation: the app boots, the legacy presentation
 * works, the React island mounts, the toggle and rollback work, and the two DOM
 * owners never overlap. Full journey and parity suites belong to Phase 5.
 *
 * No paid or external provider flow is exercised.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
