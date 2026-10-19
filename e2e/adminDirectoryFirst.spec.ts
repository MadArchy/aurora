/**
 * PERF-A — the admin directory is usable before any client is hydrated.
 * PERF-B — operational listeners and indicators belong to the client that is opened.
 * Emulator project: demo-aurora-e2e. No production Firebase.
 */
import { expect, test, type Page } from '@playwright/test';
import { CLIENT_JUAN_ID, MANAGER_EMAIL, MANAGER_PASSWORD } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const SCALE_CLIENT_IDS = Array.from({ length: 10 }, (_, index) => `client_perf_a_${String(index + 1).padStart(2, '0')}`);

type AdminLoadMarks = {
  start: number | null;
  directory: number | null;
  listeners: number | null;
  activeClient: number | null;
};

async function readAdminLoadMarks(page: Page): Promise<AdminLoadMarks> {
  return page.evaluate(() => {
    const at = (name: string) => performance.getEntriesByName(name)[0]?.startTime ?? null;
    return {
      start: at('postura:admin-auth-start'),
      directory: at('postura:admin-directory-ready'),
      listeners: at('postura:admin-listeners-attached'),
      activeClient: at('postura:admin-active-client-ready'),
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
    () => performance.getEntriesByName('postura:admin-directory-ready').length > 0,
    undefined,
    { timeout: 30_000 }
  );
}

async function listenerCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const sync = await import('/src/services/firestore/sync.ts');
    return sync.activeFirestoreListenerCount();
  });
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
      listenersMs: elapsed(marks.listeners),
      activeClientMs: elapsed(marks.activeClient),
    })
  );
}

test.describe('PERF-A admin directory first', () => {
  test('directory is usable before operational listeners, and opening one client attaches only that client', async ({ page }) => {
    test.setTimeout(120_000);
    await coldManagerLogin(page);

    const marks = await readAdminLoadMarks(page);
    expect(marks.start).not.toBeNull();
    expect(marks.directory).not.toBeNull();
    expect(marks.listeners).toBeNull();
    expect(marks.directory! - marks.start!).toBeGreaterThanOrEqual(0);

    const clientCount = Number(await page.locator('[data-testid="react-cockpit-client-count"]').innerText());
    const listeners = await listenerCount(page);
    logLoad('clients-2-directory', marks, clientCount, listeners);
    expect(clientCount).toBeGreaterThanOrEqual(2);
    expect(listeners).toBe(0);
    await expect(page.locator('[data-testid="react-cockpit-indicators"]')).toHaveAttribute('data-state', 'pending');
    await expect(page.locator('[data-testid="react-cockpit-attention"]')).toHaveText('Pendiente');
    await expect(page.locator('[data-testid="react-cockpit-theses"]')).toHaveText('Pendiente');
    await expect(page.locator('[data-testid="react-cockpit-queue"]')).toContainText('Juan');
    await expect(page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`)).toBeVisible();

    await page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(
      () => performance.getEntriesByName('postura:admin-listeners-attached').length > 0,
      undefined,
      { timeout: 30_000 }
    );
    const opened = await readAdminLoadMarks(page);
    const openedListeners = await listenerCount(page);
    const perClient = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      return sync.firestoreRealtimeListenersPerClient();
    });
    const listenerDetail = await page.evaluate(() => {
      const mark = performance.getEntriesByName('postura:admin-listeners-attached')[0] as PerformanceMark | undefined;
      const detail = mark?.detail as { clientId?: string } | undefined;
      return detail?.clientId ?? null;
    });
    logLoad('clients-2-open', opened, clientCount, openedListeners);
    expect(listenerDetail).toBe(CLIENT_JUAN_ID);
    expect(openedListeners).toBe(perClient);
    expect(opened.activeClient).not.toBeNull();
  });

  test('twelve clients keep the directory ahead of any operational hydration', async ({ page }) => {
    test.setTimeout(180_000);
    await coldManagerLogin(page);
    await seedScaleClients(page);
    await page.locator('[data-testid="react-shell-logout"]').click();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 30_000 });

    try {
      await coldManagerLogin(page);
      const marks = await readAdminLoadMarks(page);
      expect(marks.directory).not.toBeNull();
      expect(marks.listeners).toBeNull();
      const clientCount = Number(await page.locator('[data-testid="react-cockpit-client-count"]').innerText());
      const listeners = await listenerCount(page);
      logLoad('clients-12-directory', marks, clientCount, listeners);
      expect(clientCount).toBeGreaterThanOrEqual(12);
      expect(listeners).toBe(0);
      await expect(page.locator('[data-testid="react-cockpit-indicators"]')).toHaveAttribute('data-state', 'pending');
      await expect(page.locator('[data-testid="react-cockpit-attention"]')).toHaveText('Pendiente');
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
