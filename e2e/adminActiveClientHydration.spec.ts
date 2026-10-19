/**
 * PERF-B — hydrate and listen to the opened client only.
 * Emulator project: demo-aurora-e2e. No production Firebase.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { CLIENT_ELENA_ID, CLIENT_JUAN_ID, MANAGER_EMAIL, MANAGER_PASSWORD } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

function isOperationalClientRead(request: Request): boolean {
  const blob = `${request.url()}\n${request.postData() ?? ''}`;
  return /clients\/client_[A-Za-z0-9_]+\/[A-Za-z]/.test(blob);
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

async function ownerCollectionDocNames(clientId: string, collection: string): Promise<string[]> {
  const names: string[] = [];
  let pageToken = '';
  do {
    const url = new URL(
      `http://127.0.0.1:8080/v1/projects/demo-aurora-e2e/databases/(default)/documents/clients/${clientId}/${collection}`
    );
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
    if (!response.ok) throw new Error(`owner list ${clientId}/${collection} failed: ${response.status}`);
    const body = (await response.json()) as { documents?: Array<{ name: string }>; nextPageToken?: string };
    for (const document of body.documents ?? []) names.push(document.name);
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return names.sort();
}

/** Product path: the signed-in ADMIN query must carry both envelope filters. */
async function adminFilteredDocNames(page: Page, clientId: string, collection: string): Promise<string[]> {
  const token = await page.evaluate(async () => {
    const firebase = await import('/src/firebase/app.ts');
    const auth = await firebase.getFirebaseAuth();
    return auth?.currentUser ? auth.currentUser.getIdToken() : null;
  });
  if (!token) throw new Error('admin-token-unavailable');
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-aurora-e2e/databases/(default)/documents/clients/${clientId}:runQuery`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'organizationId' },
                    op: 'EQUAL',
                    value: { stringValue: 'org_aurora_01' },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'clientId' },
                    op: 'EQUAL',
                    value: { stringValue: clientId },
                  },
                },
              ],
            },
          },
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`admin query ${clientId}/${collection} failed: ${response.status}`);
  const rows = (await response.json()) as Array<{ document?: { name: string } }>;
  return rows.flatMap((row) => (row.document?.name ? [row.document.name] : [])).sort();
}

test.describe('PERF-B active client hydration', () => {
  test('opening one client does not read or erase the other client', async ({ page }) => {
    test.setTimeout(180_000);
    const operationalReads: string[] = [];
    page.on('request', (request) => {
      if (isOperationalClientRead(request)) operationalReads.push(request.url());
    });

    await coldManagerLogin(page);
    const readsBeforeOpen = operationalReads.length;
    expect(readsBeforeOpen).toBe(0);
    expect(await listenerCount(page)).toBe(0);
    await expect(page.locator('[data-testid="react-cockpit-indicators"]')).toHaveAttribute('data-state', 'pending');
    await expect(page.locator('[data-testid="react-cockpit-attention"]')).toHaveText('Pendiente');

    const productSignals = await adminFilteredDocNames(page, CLIENT_ELENA_ID, 'signals');
    const elenaSignalsBefore = await ownerCollectionDocNames(CLIENT_ELENA_ID, 'signals');
    expect(productSignals).toEqual(elenaSignalsBefore);
    const elenaTasksBefore = await ownerCollectionDocNames(CLIENT_ELENA_ID, 'tasks');
    const elenaRunsBefore = await ownerCollectionDocNames(CLIENT_ELENA_ID, 'aiRuns');
    const elenaRecommendationsBefore = await ownerCollectionDocNames(CLIENT_ELENA_ID, 'recommendations');
    const juanTasks = await ownerCollectionDocNames(CLIENT_JUAN_ID, 'tasks');
    expect(await adminFilteredDocNames(page, CLIENT_JUAN_ID, 'tasks')).toEqual(juanTasks);
    expect(juanTasks.length).toBeGreaterThan(0);

    const openStarted = Date.now();
    await page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
    const openMs = Date.now() - openStarted;
    const perClient = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      return sync.firestoreRealtimeListenersPerClient();
    });
    expect(await listenerCount(page)).toBe(perClient);

    const phases = await page.evaluate(async ({ juan, elena }) => {
      const module = await import('/src/services/db.ts');
      return {
        juan: module.dbService.getClientOperationalPhase(juan),
        elena: module.dbService.getClientOperationalPhase(elena),
        juanTasks: module.dbService.exportSnapshot().tasks.filter((task) => task.clientId === juan).length,
        elenaTasks: module.dbService.exportSnapshot().tasks.filter((task) => task.clientId === elena).length,
      };
    }, { juan: CLIENT_JUAN_ID, elena: CLIENT_ELENA_ID });
    expect(phases.juan).toBe('READY');
    expect(phases.elena).toBe('NOT_LOADED');
    expect(phases.juanTasks).toBeGreaterThan(0);
    expect(phases.elenaTasks).toBe(0);
    expect(await ownerCollectionDocNames(CLIENT_ELENA_ID, 'signals')).toEqual(elenaSignalsBefore);
    expect(await ownerCollectionDocNames(CLIENT_ELENA_ID, 'tasks')).toEqual(elenaTasksBefore);
    expect(await ownerCollectionDocNames(CLIENT_ELENA_ID, 'aiRuns')).toEqual(elenaRunsBefore);
    expect(await ownerCollectionDocNames(CLIENT_ELENA_ID, 'recommendations')).toEqual(elenaRecommendationsBefore);
    expect(await ownerCollectionDocNames(CLIENT_JUAN_ID, 'tasks')).toEqual(juanTasks);

    const readsForElena = operationalReads.filter((url) => url.includes(CLIENT_ELENA_ID));
    expect(readsForElena).toEqual([]);

    await page.locator('[data-testid="react-shell-logout"]').click();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 30_000 });
    await coldManagerLogin(page);
    await page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('.sidebar-link[data-tab="clients"]').click();
    await page.locator(`[data-testid="react-cockpit-open-${CLIENT_ELENA_ID}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
    expect(await listenerCount(page)).toBe(perClient);
    const afterSwitch = await page.evaluate(async ({ juan, elena }) => {
      const module = await import('/src/services/db.ts');
      return {
        juanTasks: module.dbService.exportSnapshot().tasks.filter((task) => task.clientId === juan).map((task) => task.id).sort(),
        elena: module.dbService.getClientOperationalPhase(elena),
      };
    }, { juan: CLIENT_JUAN_ID, elena: CLIENT_ELENA_ID });
    expect(afterSwitch.juanTasks.length).toBeGreaterThan(0);
    expect(afterSwitch.elena === 'READY' || afterSwitch.elena === 'EMPTY').toBe(true);
    expect(await ownerCollectionDocNames(CLIENT_ELENA_ID, 'signals')).toEqual(elenaSignalsBefore);
    expect(await ownerCollectionDocNames(CLIENT_ELENA_ID, 'tasks')).toEqual(elenaTasksBefore);

    const directoryMs = await page.evaluate(() => {
      const start = performance.getEntriesByName('postura:admin-auth-start')[0]?.startTime;
      const directory = performance.getEntriesByName('postura:admin-directory-ready')[0]?.startTime;
      if (start === undefined || directory === undefined) return null;
      return Math.round(directory - start);
    });
    console.log(JSON.stringify({ label: 'perf-b-open', directoryMs, openMs, listeners: perClient }));
  });
});
