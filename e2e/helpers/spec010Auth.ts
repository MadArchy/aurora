/**
 * SPEC-010 Phase 5 — deterministic authenticated Playwright helpers.
 *
 * Uses the same demo credentials documented in docs/ops/pilot.md.
 * Test-only: no production auth bypass is introduced.
 */
import { expect, type Page } from '@playwright/test';

export const UI_MODE_KEY = 'postura_ui_mode';

export const MANAGER_EMAIL = 'manager@postura.internal';
export const MANAGER_PASSWORD = 'Postura2026!';
export const CLIENT_JUAN_EMAIL = 'juan.vasquez@lexfirm.com';
export const CLIENT_ELENA_EMAIL = 'elena.martinez@lexfirm.com';
export const CLIENT_PASSWORD = 'Postura2026!';
export const CLIENT_JUAN_ID = 'client_juan_001';

export function businessSnapshot(page: Page) {
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

/** Keys that may drift from background schedulers unrelated to UI-mode rollback. */
const ROLLBACK_VOLATILE_KEYS = new Set([
  'postura_source_agent_v1',
  'postura_source_automation_v1',
]);

export function rollbackStableSnapshot(page: Page) {
  return businessSnapshot(page).then((snapshot) => {
    const stable: Record<string, string> = {};
    for (const [key, value] of Object.entries(snapshot)) {
      if (!ROLLBACK_VOLATILE_KEYS.has(key)) stable[key] = value;
    }
    return stable;
  });
}

export async function visibleRoots(page: Page) {
  return page.evaluate(() => {
    const shown = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return false;
      return getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden');
    };
    return ['app', 'react-root'].filter(shown);
  });
}

export function sidebarTab(page: Page, tab: string) {
  return page.locator(`.sidebar-link[data-tab="${tab}"]`);
}

export async function enableReactMode(page: Page) {
  await page.goto('/');
  await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
  await page.reload();
}

export async function login(page: Page, email: string, password: string) {
  await enableReactMode(page);
  await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  await page.fill('#react-login-email', email);
  await page.fill('#react-login-password', password);
  await page.click('[data-testid="react-login-submit"]');
  await expect(page.locator('[data-testid="react-login"]')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible();
}

export async function loginAsManager(page: Page) {
  await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
}

export async function loginAsClientJuan(page: Page) {
  await login(page, CLIENT_JUAN_EMAIL, CLIENT_PASSWORD);
}

export async function loginAsClientElena(page: Page) {
  await login(page, CLIENT_ELENA_EMAIL, CLIENT_PASSWORD);
}

export async function enterClientWorkspaceFromShell(page: Page) {
  await sidebarTab(page, 'clients').click();
  const openWorkspace = page.locator('[data-testid="react-cockpit-queue"] button', {
    hasText: 'Abrir workspace',
  }).first();
  await expect(openWorkspace).toBeVisible({ timeout: 15_000 });
  await openWorkspace.click();
  await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 15_000 });
}

export async function openManagerWorkspace(page: Page, clientId = CLIENT_JUAN_ID) {
  await loginAsManager(page);
  await enterClientWorkspaceFromShell(page);
  void clientId;
}
