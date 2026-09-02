/**
 * SPEC-010 T-010-403 — Stage-B seam inversion E2E (minimum coverage).
 */

import { expect, test } from '@playwright/test';

const UI_MODE_KEY = 'postura_ui_mode';

function businessSnapshot(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || key === 'postura_ui_mode') continue;
      snapshot[key] = localStorage.getItem(key) ?? '';
    }
    return snapshot;
  });
}

test.describe('T-010-403 Stage-B seam inversion', () => {
  test('Stage-B normal mode boots the React shell by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('[data-testid="react-login"], [data-testid="react-shell"]')).toBeVisible();
  });

  test('explicit legacy rollback still boots the legacy shell', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#react-root')).toBeHidden();
    await expect(page.locator('#form-login')).toBeVisible();
  });

  test('rollback does not mutate business storage', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);

    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#app')).toBeVisible();

    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('exactly one global presentation root is visible in normal Stage-B mode', async ({ page }) => {
    await page.goto('/');

    const visibleRoots = await page.evaluate(() => {
      const shown = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden');
      };
      return ['app', 'react-root'].filter(shown);
    });

    expect(visibleRoots).toEqual(['react-root']);
  });
});
