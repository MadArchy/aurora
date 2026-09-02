/**
 * SPEC-010 Phase 1 — strangler foundation E2E (T-010-104).
 *
 * Proves the four foundation properties and nothing more:
 *   1. the app boots and the React presentation is the Stage-B default
 *   2. the React island mounts when requested
 *   3. rollback returns to legacy without touching business state
 *   4. the two DOM owners never render simultaneously
 *
 * Product parity for migrated pages is Phase-5 work and is not claimed here.
 */

import { expect, test } from '@playwright/test';

const UI_MODE_KEY = 'postura_ui_mode';

test.describe('strangler foundation', () => {
  test('the app boots with the React presentation by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();

    // Legacy rollback remains available but is hidden in normal Stage-B mode.
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('[data-testid="react-shell"]')).toHaveCount(0);
  });

  test('the React island mounts when the toggle is set', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'react'),
      [UI_MODE_KEY]
    );
    await page.reload();

    await expect(page.locator('#react-root')).toBeVisible();
    // Unauthenticated, so the React shell presents its login surface.
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  });

  test('only one presentation owner is visible at a time', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'react'),
      [UI_MODE_KEY]
    );
    await page.reload();

    // React visible implies legacy hidden — never both.
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    // And the React root never contains legacy markup, nor vice versa.
    await expect(page.locator('#react-root #app')).toHaveCount(0);
    await expect(page.locator('#app #react-root')).toHaveCount(0);
  });

  test('rollback to legacy works and leaves business state untouched', async ({ page }) => {
    await page.goto('/');

    // Snapshot every persisted business key before switching presentation.
    const before = await page.evaluate(() => {
      const snapshot: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || key === 'postura_ui_mode') continue;
        snapshot[key] = localStorage.getItem(key) ?? '';
      }
      return snapshot;
    });

    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'react'),
      [UI_MODE_KEY]
    );
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();

    // Roll back through the seam's own control, as a user would.
    await page.locator('[data-testid="react-login-to-legacy"]').click();

    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#react-root')).toBeHidden();
    // The React root is emptied on unmount.
    await expect(page.locator('[data-testid="react-login"]')).toHaveCount(0);

    const after = await page.evaluate(() => {
      const snapshot: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || key === 'postura_ui_mode') continue;
        snapshot[key] = localStorage.getItem(key) ?? '';
      }
      return snapshot;
    });

    // Rollback required no data migration: canonical/business storage is identical.
    expect(after).toEqual(before);
  });

  test('the legacy application remains fully operational after a React round trip', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'react'),
      [UI_MODE_KEY]
    );
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();

    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'legacy'),
      [UI_MODE_KEY]
    );
    await page.reload();

    // Legacy renders its own interactive login form again.
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#form-login')).toBeVisible();
  });
});
