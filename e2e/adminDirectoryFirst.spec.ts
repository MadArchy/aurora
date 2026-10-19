/**
 * PERF-A — the admin directory is usable before operational hydration finishes.
 * Emulator project: demo-aurora-e2e. No production Firebase.
 */
import { expect, test, type Page } from '@playwright/test';
import { MANAGER_EMAIL, MANAGER_PASSWORD } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const SCALE_CLIENT_IDS = Array.from({ length: 10 }, (_, index) => `client_perf_a_${String(index + 1).padStart(2, '0')}`);

type AdminLoadMarks = {
  start: number | null;
  directory: number | null;
  indicators: number | null;
  listeners: number | null;
};

async function readAdminLoadMarks(page: Page): Promise<AdminLoadMarks> {
  return page.evaluate(() => {
    const at = (name: string) => performance.getEntriesByName(name)[0]?.startTime ?? null;
    return {
      start: at('postura:admin-auth-start'),
      directory: at('postura:admin-directory-ready'),
      indicators: at('postura:admin-indicators-ready'),
      listeners: at('postura:admin-listeners-attached'),
    };
  });
}

async function coldManagerLogin(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('postura_ui_mode', 'react'));
  await page.reload();
  await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  await page.fill('#react-login-email', MANAGER_EMAIL);
  await page.fill('#react-login-password', MANAGER_PASSWORD);
  await page.click('[data-testid="react-login-submit"]');
  await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="react-cockpit-client-count"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => performance.getEntriesByName('postura:admin-listeners-attached').length > 0,
    undefined,
    { timeout: 60_000 }
  );
}

async function adminIdToken(page: Page): Promise<string> {
  const token = await page.evaluate(async () => {
    const firebase = await import('/src/firebase/app.ts');
    const auth = await firebase.getFirebaseAuth();
    return auth?.currentUser ? auth.currentUser.getIdToken() : null;
  });
  if (!token) throw new Error('admin-token-unavailable');
  return token;
}

async function seedScaleClients(page: Page): Promise<void> {
  const token = await adminIdToken(page);
  for (const id of SCALE_CLIENT_IDS) {
    const response = await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-aurora-e2e/databases/(default)/documents/clients?documentId=${id}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            organizationId: { stringValue: 'org_aurora_01' },
            primaryManagerId: { stringValue: 'user_admin_01' },
            firstName: { stringValue: 'Scale' },
            lastName: { stringValue: id },
            displayName: { stringValue: `Scale ${id}` },
            primaryEmail: { stringValue: `${id}@example.com` },
            onboardingStatus: { stringValue: 'COMPLETED' },
            status: { stringValue: 'ACTIVE' },
            activeThesesCount: { integerValue: '0' },
            completedTasksCount: { integerValue: '0' },
          },
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`seed ${id} failed: ${response.status} ${await response.text()}`);
    }
  }
}

async function deleteScaleClients(page: Page): Promise<void> {
  const token = await adminIdToken(page).catch(() => null);
  if (!token) return;
  for (const id of SCALE_CLIENT_IDS) {
    await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-aurora-e2e/databases/(default)/documents/clients/${id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
  }
}

function logLoad(label: string, marks: AdminLoadMarks, clientCount: number, listeners: number): void {
  const elapsed = (mark: number | null) => (marks.start !== null && mark !== null ? Math.round(mark - marks.start) : null);
  console.log(
    JSON.stringify({
      label,
      clientCount,
      listeners,
      directoryMs: elapsed(marks.directory),
      indicatorsMs: elapsed(marks.indicators),
      listenersMs: elapsed(marks.listeners),
    })
  );
}

test.describe('PERF-A admin directory first', () => {
  test('directory marks precede indicator marks on a cold admin login', async ({ page }) => {
    test.setTimeout(120_000);
    await coldManagerLogin(page);

    const marks = await readAdminLoadMarks(page);
    expect(marks.start).not.toBeNull();
    expect(marks.directory).not.toBeNull();
    expect(marks.indicators).not.toBeNull();
    expect(marks.listeners).not.toBeNull();
    expect(marks.directory! - marks.start!).toBeGreaterThanOrEqual(0);
    expect(marks.indicators! - marks.directory!).toBeGreaterThanOrEqual(0);
    expect(marks.listeners! - marks.indicators!).toBeGreaterThanOrEqual(0);

    const clientCount = Number(await page.locator('[data-testid="react-cockpit-client-count"]').innerText());
    const listeners = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      return sync.activeFirestoreListenerCount();
    });
    logLoad('clients-2', marks, clientCount, listeners);
    expect(clientCount).toBeGreaterThanOrEqual(2);
    await expect(page.locator('[data-testid="react-cockpit-indicators"]')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('[data-testid="react-cockpit-queue"]')).toContainText('Juan');
    await expect(page.locator('[data-testid="react-cockpit-queue"] button', { hasText: 'Abrir workspace' }).first()).toBeVisible();
  });

  test('twelve clients keep the directory ahead of operational hydration', async ({ page }) => {
    test.setTimeout(180_000);
    await coldManagerLogin(page);
    await seedScaleClients(page);
    await page.locator('[data-testid="react-shell-logout"]').click();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 30_000 });

    try {
      await coldManagerLogin(page);
      const marks = await readAdminLoadMarks(page);
      expect(marks.directory).not.toBeNull();
      expect(marks.indicators).not.toBeNull();
      expect(marks.indicators! - marks.directory!).toBeGreaterThanOrEqual(0);
      const clientCount = Number(await page.locator('[data-testid="react-cockpit-client-count"]').innerText());
      const listeners = await page.evaluate(async () => {
        const sync = await import('/src/services/firestore/sync.ts');
        return sync.activeFirestoreListenerCount();
      });
      logLoad('clients-12', marks, clientCount, listeners);
      expect(clientCount).toBeGreaterThanOrEqual(12);
      await expect(page.locator('[data-testid="react-cockpit-indicators"]')).toHaveAttribute('data-state', 'ready');
    } finally {
      await deleteScaleClients(page);
    }
  });

  test('a failed directory query does not render an empty portfolio', async ({ page }) => {
    test.setTimeout(120_000);
    await coldManagerLogin(page);
    await page.evaluate(async () => {
      const module = await import('/src/services/db.ts');
      const epoch = module.dbService.beginAdminDirectoryLoad();
      module.dbService.markAdminDirectoryError(epoch);
    });

    await expect(page.locator('[data-testid="react-cockpit-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-cockpit-error"]')).toContainText('consulta falló');
    await expect(page.locator('[data-testid="react-cockpit-client-count"]')).toHaveCount(0);
  });
});
