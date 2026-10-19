/**
 * PERF-B — hydrate and listen to the opened client only.
 * Emulator project: demo-aurora-e2e. No production Firebase.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { CLIENT_ELENA_ID, CLIENT_JUAN_ID, MANAGER_EMAIL, MANAGER_PASSWORD } from './helpers/spec010Auth';
import { clientDocPath, FIXTURE_ORG_ID, ownerSeedDoc, ownerSeedTask, waitForServerField } from './support/clientFixtures';

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

const EMULATOR_DOCUMENTS =
  'http://127.0.0.1:8080/v1/projects/demo-aurora-e2e/databases/(default)/documents';

type RemoteValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
};

type RemoteDocument = {
  name: string;
  updateTime: string | null;
  fields: Record<string, string>;
};

function flattenRemoteValue(value: RemoteValue): string {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return `int:${value.integerValue}`;
  if (value.doubleValue !== undefined) return `double:${value.doubleValue}`;
  if (value.booleanValue !== undefined) return `bool:${value.booleanValue}`;
  if (value.timestampValue !== undefined) return `time:${value.timestampValue}`;
  if ('nullValue' in value) return 'null';
  return JSON.stringify(value);
}

/** Emulator owner oracle: document identity, update time, and field values. */
async function ownerCollectionSnapshot(clientId: string, collection: string): Promise<RemoteDocument[]> {
  const documents: RemoteDocument[] = [];
  let pageToken = '';
  do {
    const url = new URL(`${EMULATOR_DOCUMENTS}/clients/${clientId}/${collection}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
    if (!response.ok) throw new Error(`owner snapshot ${clientId}/${collection} failed: ${response.status}`);
    const body = (await response.json()) as {
      documents?: Array<{ name: string; updateTime?: string; fields?: Record<string, RemoteValue> }>;
      nextPageToken?: string;
    };
    for (const document of body.documents ?? []) {
      const fields = Object.fromEntries(
        Object.entries(document.fields ?? {})
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => [key, flattenRemoteValue(value)])
      );
      documents.push({ name: document.name, updateTime: document.updateTime ?? null, fields });
    }
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return documents.sort((left, right) => left.name.localeCompare(right.name));
}

async function ownerDeleteDoc(path: string): Promise<void> {
  const response = await fetch(`${EMULATOR_DOCUMENTS}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`owner delete ${path} failed: ${response.status}`);
  }
}

async function adminQueryStatus(
  page: Page,
  clientId: string,
  collection: string,
  organizationId: string,
  queryClientId: string
): Promise<number> {
  const token = await page.evaluate(async () => {
    const firebase = await import('/src/firebase/app.ts');
    const auth = await firebase.getFirebaseAuth();
    return auth?.currentUser ? auth.currentUser.getIdToken() : null;
  });
  if (!token) throw new Error('admin-token-unavailable');
  const response = await fetch(`${EMULATOR_DOCUMENTS}/clients/${clientId}:runQuery`, {
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
                  value: { stringValue: organizationId },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'clientId' },
                  op: 'EQUAL',
                  value: { stringValue: queryClientId },
                },
              },
            ],
          },
        },
      },
    }),
  });
  return response.status;
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

  test('a populated second client keeps its documents while another client is edited', async ({ page }) => {
    test.setTimeout(180_000);
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const signalId = `h1b_signal_${stamp}`;
    const taskId = `h1b_task_${stamp}`;
    const runId = `h1b_run_${stamp}`;
    const recommendationId = `h1b_rec_${stamp}`;
    const activeTaskId = `h1a_task_${stamp}`;
    const evidenceUrl = `https://diag.local/h1-a-${stamp}`;
    const seededAt = '2026-10-19T12:00:00.000Z';
    const seededPaths = [
      clientDocPath(CLIENT_ELENA_ID, 'signals', signalId),
      clientDocPath(CLIENT_ELENA_ID, 'tasks', taskId),
      clientDocPath(CLIENT_ELENA_ID, 'aiRuns', runId),
      clientDocPath(CLIENT_ELENA_ID, 'recommendations', recommendationId),
      clientDocPath(CLIENT_JUAN_ID, 'tasks', activeTaskId),
    ];
    const readsForElena: string[] = [];
    page.on('request', (request) => {
      const blob = `${request.url()}\n${request.postData() ?? ''}`;
      if (blob.includes(CLIENT_ELENA_ID)) readsForElena.push(request.url());
    });

    try {
      await ownerSeedDoc(seededPaths[0], {
        id: signalId,
        organizationId: FIXTURE_ORG_ID,
        clientId: CLIENT_ELENA_ID,
        title: 'H1 synthetic signal',
        sourceType: 'MANUAL',
        sourceName: 'H1 fixture',
        contentSnippet: 'Synthetic emulator signal for hydration integrity.',
        fingerprint: `h1-fp-${stamp}`,
        detectedAt: seededAt,
        status: 'NEW',
        aiStatus: 'NOT_REQUIRED',
        managerDecision: 'UNREVIEWED',
        createdAt: seededAt,
        createdBy: 'e2e_h1',
        updatedAt: seededAt,
        updatedBy: 'e2e_h1',
      });
      await ownerSeedTask({
        id: taskId,
        clientId: CLIENT_ELENA_ID,
        type: 'SUBMIT_INFO',
        title: 'H1 synthetic task',
        status: 'IN_PROGRESS',
        evidenceUrl: 'https://diag.local/h1-b-seed',
        createdAt: seededAt,
        updatedAt: seededAt,
      });
      await ownerSeedDoc(seededPaths[2], {
        id: runId,
        organizationId: FIXTURE_ORG_ID,
        clientId: CLIENT_ELENA_ID,
        agent: 'RESEARCH_SIGNALS',
        provider: 'OPENAI',
        modelName: 'h1-synthetic-model',
        promptTemplateId: 'h1-template',
        inputContextSummary: 'Synthetic context',
        outputPayload: 'Synthetic output',
        promptTokens: 2,
        completionTokens: 3,
        totalCostUsd: 0,
        latencyMs: 4,
        validationPassed: true,
        securityCheckPassed: true,
        status: 'SUCCESS',
        createdAt: seededAt,
      });
      await ownerSeedDoc(seededPaths[3], {
        id: recommendationId,
        organizationId: FIXTURE_ORG_ID,
        clientId: CLIENT_ELENA_ID,
        thesisId: 'thesis_h1_synthetic',
        type: 'ARTICLE_LONG',
        proposedAngle: 'H1 synthetic angle',
        strategicRationale: 'Synthetic rationale',
        urgency: 'LOW',
        impactScore: 1,
        status: 'GENERATED',
        createdAt: seededAt,
      });
      await ownerSeedTask({
        id: activeTaskId,
        clientId: CLIENT_JUAN_ID,
        type: 'SUBMIT_INFO',
        title: 'H1 active client task',
        status: 'IN_PROGRESS',
        evidenceUrl: 'https://diag.local/h1-a-seed',
        createdAt: seededAt,
        updatedAt: seededAt,
      });

      const before = {
        signals: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'signals'),
        tasks: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'tasks'),
        aiRuns: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'aiRuns'),
        recommendations: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'recommendations'),
      };
      for (const [collection, id] of [
        ['signals', signalId],
        ['tasks', taskId],
        ['aiRuns', runId],
        ['recommendations', recommendationId],
      ] as const) {
        expect(before[collection].some((document) => document.name.endsWith(`/${id}`))).toBe(true);
      }
      expect(before.signals.find((document) => document.name.endsWith(`/${signalId}`))?.fields.title).toBe(
        'H1 synthetic signal'
      );
      expect(before.tasks.find((document) => document.name.endsWith(`/${taskId}`))?.fields.status).toBe('IN_PROGRESS');
      expect(before.aiRuns.find((document) => document.name.endsWith(`/${runId}`))?.fields.modelName).toBe(
        'h1-synthetic-model'
      );
      expect(
        before.recommendations.find((document) => document.name.endsWith(`/${recommendationId}`))?.fields.proposedAngle
      ).toBe('H1 synthetic angle');

      await coldManagerLogin(page);
      expect(await listenerCount(page)).toBe(0);
      const readsAtDirectory = readsForElena.length;
      expect(readsAtDirectory).toBe(0);
      for (const collection of ['signals', 'tasks', 'aiRuns', 'recommendations'] as const) {
        expect(await adminFilteredDocNames(page, CLIENT_ELENA_ID, collection)).toEqual(
          before[collection].map((document) => document.name)
        );
        expect(await adminQueryStatus(page, CLIENT_ELENA_ID, collection, 'org_other', CLIENT_ELENA_ID)).toBe(403);
      }

      const openStarted = Date.now();
      await page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`).click();
      await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
      const openMs = Date.now() - openStarted;
      expect(readsForElena).toEqual([]);
      const beforeEdit = await page.evaluate(async ({ elena, activeTask }) => {
        const { dbService } = await import('/src/services/db.ts');
        const snapshot = dbService.exportSnapshot();
        return {
          elenaPhase: dbService.getClientOperationalPhase(elena),
          elenaSignals: snapshot.signals.filter((row) => row.clientId === elena).map((row) => row.id),
          elenaTasks: snapshot.tasks.filter((row) => row.clientId === elena).map((row) => row.id),
          elenaRuns: snapshot.aiRuns.filter((row) => row.clientId === elena).map((row) => row.id),
          elenaRecommendations: snapshot.recommendations.filter((row) => row.clientId === elena).map((row) => row.id),
          activePresent: snapshot.tasks.some((row) => row.id === activeTask),
        };
      }, { elena: CLIENT_ELENA_ID, activeTask: activeTaskId });
      expect(beforeEdit).toEqual({
        elenaPhase: 'NOT_LOADED',
        elenaSignals: [],
        elenaTasks: [],
        elenaRuns: [],
        elenaRecommendations: [],
        activePresent: true,
      });

      await page.evaluate(async ({ taskId: id, evidence }) => {
        const { dbService } = await import('/src/services/db.ts');
        dbService.updateTaskEvidence(id, evidence);
      }, { taskId: activeTaskId, evidence: evidenceUrl });
      await waitForServerField(clientDocPath(CLIENT_JUAN_ID, 'tasks', activeTaskId), 'evidenceUrl', evidenceUrl);
      expect(readsForElena).toEqual([]);

      const afterEdit = {
        signals: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'signals'),
        tasks: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'tasks'),
        aiRuns: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'aiRuns'),
        recommendations: await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'recommendations'),
      };
      expect(afterEdit).toEqual(before);

      await page.locator('.sidebar-link[data-tab="clients"]').click();
      await page.locator(`[data-testid="react-cockpit-open-${CLIENT_ELENA_ID}"]`).click();
      await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
      const loaded = await page.evaluate(async ({ elena, juan }) => {
        const { dbService } = await import('/src/services/db.ts');
        const snapshot = dbService.exportSnapshot();
        const idsFor = (rows: Array<{ id: string; clientId?: string | null }>) =>
          rows.filter((row) => row.clientId === elena).map((row) => row.id).sort();
        return {
          phase: dbService.getClientOperationalPhase(elena),
          signals: idsFor(snapshot.signals),
          tasks: idsFor(snapshot.tasks),
          aiRuns: idsFor(snapshot.aiRuns),
          recommendations: idsFor(snapshot.recommendations),
          juanTask: snapshot.tasks.some((row) => row.id === juan),
        };
      }, { elena: CLIENT_ELENA_ID, juan: activeTaskId });
      expect(loaded.phase).toBe('READY');
      expect(loaded.signals).toEqual([signalId]);
      expect(loaded.tasks).toEqual([taskId]);
      expect(loaded.aiRuns).toEqual([runId]);
      expect(loaded.recommendations).toEqual([recommendationId]);
      expect(loaded.juanTask).toBe(true);

      await page.locator('.sidebar-link[data-tab="clients"]').click();
      await page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`).click();
      await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
      const returned = await page.evaluate(async ({ elena, ids }) => {
        const { dbService } = await import('/src/services/db.ts');
        const snapshot = dbService.exportSnapshot();
        return {
          signals: snapshot.signals.filter((row) => row.clientId === elena).map((row) => row.id).sort(),
          tasks: snapshot.tasks.filter((row) => row.clientId === elena).map((row) => row.id).sort(),
          aiRuns: snapshot.aiRuns.filter((row) => row.clientId === elena).map((row) => row.id).sort(),
          recommendations: snapshot.recommendations
            .filter((row) => row.clientId === elena)
            .map((row) => row.id)
            .sort(),
          evidence: snapshot.tasks.find((row) => row.id === ids.activeTaskId)?.evidenceUrl ?? null,
        };
      }, { elena: CLIENT_ELENA_ID, ids: { activeTaskId } });
      expect(returned).toEqual({
        signals: [signalId],
        tasks: [taskId],
        aiRuns: [runId],
        recommendations: [recommendationId],
        evidence: evidenceUrl,
      });
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'signals')).toEqual(before.signals);
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'tasks')).toEqual(before.tasks);
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'aiRuns')).toEqual(before.aiRuns);
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'recommendations')).toEqual(before.recommendations);

      const stale = await page.evaluate(async ({ elena, org }) => {
        const { dbService } = await import('/src/services/db.ts');
        const epoch = dbService.getAdminLoadEpoch();
        const ticket = dbService.beginActiveClientHydration(elena);
        const tasksBefore = dbService.exportSnapshot().tasks.filter((row) => row.clientId === elena).map((row) => row.id).sort();
        const runsBefore = dbService.exportSnapshot().aiRuns.filter((row) => row.clientId === elena).map((row) => row.id).sort();
        dbService.beginAdminDirectoryLoad();
        const result = dbService.applyActiveClientListing(
          elena,
          org,
          { tasks: [], signals: [], aiRuns: [], recommendations: [] },
          ticket,
          epoch
        );
        const snapshot = dbService.exportSnapshot();
        return {
          result,
          tasksBefore,
          tasksAfter: snapshot.tasks.filter((row) => row.clientId === elena).map((row) => row.id).sort(),
          runsAfter: snapshot.aiRuns.filter((row) => row.clientId === elena).map((row) => row.id).sort(),
          runsBefore,
        };
      }, { elena: CLIENT_ELENA_ID, org: FIXTURE_ORG_ID });
      expect(stale.result).toBe('stale');
      expect(stale.tasksAfter).toEqual(stale.tasksBefore);
      expect(stale.runsAfter).toEqual(stale.runsBefore);
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'signals')).toEqual(before.signals);
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'tasks')).toEqual(before.tasks);
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'aiRuns')).toEqual(before.aiRuns);
      expect(await ownerCollectionSnapshot(CLIENT_ELENA_ID, 'recommendations')).toEqual(before.recommendations);
      console.log(JSON.stringify({
        label: 'perf-b-h1-populated',
        openMs,
        populatedDocuments: 4,
        listenersAtDirectory: 0,
      }));
    } finally {
      for (const path of seededPaths) await ownerDeleteDoc(path);
    }
  });
});
