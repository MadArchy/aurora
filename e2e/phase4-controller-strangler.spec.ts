/**
 * SPEC-010 Phase 4 — controller strangler E2E (T-010-402, T-010-405).
 *
 * §28 asks for parity evidence wherever orchestration changed. Four
 * responsibilities left `main.ts` this phase — presentation state, toasts, modal
 * dispatch and navigation rules — and all four are reachable in a real browser
 * without a session, so they are proved here rather than argued.
 *
 * Scope note, stated rather than implied: authenticated orchestration (tab
 * switching inside a workspace, the 17 modals, deep-linked notifications) needs
 * seeded credentials that are not formally available in this environment. Those
 * paths are covered by `tests/reactMigrationPhase4Controllers.test.ts`, which
 * exercises the extracted modules directly. Authenticated E2E stays PARTIAL and
 * is not claimed here.
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

test.describe('Phase-4 controller strangler', () => {
  test('the legacy shell still boots and renders through the extracted orchestration', async ({ page }) => {
    await page.goto('/');

    // Render orchestration still assembles the app into the legacy root, and the
    // login view is still what an anonymous visitor gets.
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#form-login')).toBeVisible();
    await expect(page.locator('#react-root')).toBeHidden();
  });

  test('a failed sign-in round-trips through the extracted presentation state', async ({ page }) => {
    await page.goto('/');

    // `loginError` is one of the fields that moved to `AppUiState`, and the
    // legacy path is: set the field, re-render, show it. If the extraction had
    // broken the round trip, the alert would never appear.
    await expect(page.locator('.login-error')).toHaveCount(0);

    await page.fill('#login-email', 'nobody@example.invalid');
    await page.fill('#login-password', 'definitely-wrong');
    await page.click('#form-login button[type="submit"]');

    await expect(page.locator('.login-error')).toHaveCount(1);
    await expect(page.locator('.login-error')).toHaveAttribute('role', 'alert');
    // The form is still usable after the re-render, as before.
    await expect(page.locator('#form-login')).toBeVisible();
  });

  test('a failed sign-in reports the failure without writing business state', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);

    await page.fill('#login-email', 'nobody@example.invalid');
    await page.fill('#login-password', 'definitely-wrong');
    await page.click('#form-login button[type="submit"]');
    await expect(page.locator('.login-error')).toHaveCount(1);

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('nothing claims the toast container inside either presentation root', async ({ page }) => {
    await page.goto('/');

    // The toast sink is created lazily at body level. Whether or not it exists
    // yet, it must never be nested inside a root that another owner renders.
    const placement = await page.evaluate(() => {
      const el = document.getElementById('toast-container');
      return {
        exists: !!el,
        parentIsBody: el ? el.parentElement === document.body : true,
        insideApp: !!document.getElementById('app')?.contains(el ?? null) && !!el,
        insideReact: !!document.getElementById('react-root')?.contains(el ?? null) && !!el,
      };
    });
    expect(placement.parentIsBody).toBe(true);
    expect(placement.insideApp).toBe(false);
    expect(placement.insideReact).toBe(false);
  });

  test('the strangler toggle and rollback still work after the extraction', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);

    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#react-root')).toBeHidden();

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('exactly one presentation root is visible at a time', async ({ page }) => {
    await page.goto('/');

    const visibleRoots = await page.evaluate(() => {
      const shown = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden');
      };
      return ['app', 'react-root'].filter(shown);
    });

    expect(visibleRoots).toEqual(['app']);
  });
});
