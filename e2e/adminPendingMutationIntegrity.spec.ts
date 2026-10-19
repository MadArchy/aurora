/**
 * SPEC-010 · ADMIN pending mutation integrity (emulator only).
 *
 * Regression for ADMIN-D1: an ADMIN push must write only the documents ADMIN changed, keep a
 * pending ADMIN mutation across realtime snapshots, never revert another writer's change, keep
 * `completedTasksCount` consistent across sessions, and surface a same-field conflict instead of
 * overwriting it silently. Another writer is the emulator OWNER (stand-in for CLIENT, a second
 * ADMIN or a Function) or a second real ADMIN session.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { assertLoopbackEmulatorHost, assertNonProductionFirebaseProjectForE2E } from '../src/firebase/productionGuard';
import { CLIENT_JUAN_ID, MANAGER_EMAIL, MANAGER_PASSWORD } from './helpers/spec010Auth';
import {
  clientDocPath,
  FIXTURE_JUAN_THESIS_ID,
  FIXTURE_ORG_ID,
  loginClientWithSettledSession,
  ownerGetField,
  ownerGetIntegerField,
  ownerSeedDoc,
  ownerSeedTask,
  waitForLocalDoc,
  waitForServerField,
} from './support/clientFixtures';
import { resolveE2EFirebaseEnv } from './support/globalSetup';

test.use({ channel: 'chrome' });

const BASE_URL = 'http://127.0.0.1:3100';
const SEED_URL = 'https://diag.local/seed';
const ROOT = `clients/${CLIENT_JUAN_ID}`;
const SEEDED_AT = '2026-01-01T00:00:00.000Z';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const EXTERNAL_FONT = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/** Every non-loopback request a page attempted; fonts are aborted, anything else fails the test. */
const externalRequests: string[] = [];

async function isolate(page: Page) {
  await page.route(EXTERNAL_FONT, (route) => route.abort());
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!LOOPBACK_HOSTS.has(new URL(url).hostname)) externalRequests.push(url);
  });
}

function emulatorDocumentsBase(): string {
  const env = resolveE2EFirebaseEnv();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  assertNonProductionFirebaseProjectForE2E(
    { projectId, useEmulators: env.VITE_FIREBASE_USE_EMULATORS === 'true' },
    'adminPendingMutationIntegrity'
  );
  const host = assertLoopbackEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST, 'adminPendingMutationIntegrity');
  return `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
}

/** OWNER read of one timestamp field as ISO; `null` when the doc or field is absent. */
async function ownerGetTimestamp(path: string, field: string): Promise<string | null> {
  const res = await fetch(`${emulatorDocumentsBase()}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`[adminPendingMutationIntegrity] owner GET ${path}: HTTP ${res.status}`);
  const body = (await res.json()) as { fields?: Record<string, { timestampValue?: string }> };
  return body.fields?.[field]?.timestampValue ?? null;
}

const taskPath = (id: string) => clientDocPath(CLIENT_JUAN_ID, 'tasks', id);

function seedTask(id: string, extra: Record<string, unknown> = {}) {
  return ownerSeedTask({
    id,
    clientId: CLIENT_JUAN_ID,
    type: 'SUBMIT_INFO',
    title: `integrity ${id}`,
    status: 'IN_PROGRESS',
    evidenceUrl: SEED_URL,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
    ...extra,
  });
}

/** Full-document OWNER replace of a seeded task: another writer's legitimate change. */
function foreignReplace(id: string, fields: Record<string, unknown>) {
  return ownerSeedDoc(taskPath(id), {
    id,
    organizationId: FIXTURE_ORG_ID,
    thesisId: FIXTURE_JUAN_THESIS_ID,
    clientId: CLIENT_JUAN_ID,
    type: 'SUBMIT_INFO',
    title: `integrity ${id}`,
    description: 'E2E fixture task seeded by the emulator owner.',
    estimatedMinutes: 10,
    status: 'IN_PROGRESS',
    evidenceUrl: SEED_URL,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
    ...fields,
  });
}

type LocalTask = { status: string; evidenceUrl: string | null; title: string } | null;

function localTask(page: Page, id: string): Promise<LocalTask> {
  return page.evaluate(async (taskId) => {
    const { dbService } = await import('/src/services/db.ts');
    const task = dbService.getAllTasks().find((row) => row.id === taskId);
    return task ? { status: task.status, evidenceUrl: task.evidenceUrl ?? null, title: task.title } : null;
  }, id);
}

function setEvidence(page: Page, id: string, url: string) {
  return page.evaluate(
    async ({ taskId, evidenceUrl }) => {
      const { dbService } = await import('/src/services/db.ts');
      dbService.updateTaskEvidence(taskId, evidenceUrl);
    },
    { taskId: id, evidenceUrl: url }
  );
}

function completeTask(page: Page, id: string) {
  return page.evaluate(async (taskId) => {
    const { dbService } = await import('/src/services/db.ts');
    dbService.updateTaskStatus(taskId, 'COMPLETED');
  }, id);
}

/** Realtime catch-up barrier: a fresh doc reaches every page, so earlier snapshots were delivered. */
async function settle(pages: Page[]) {
  const id = await seedTask(`integrity_marker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  for (const page of pages) await waitForLocalDoc(page, 'task', id);
}

async function managerSession(page: Page) {
  await isolate(page);
  await loginClientWithSettledSession(page, MANAGER_EMAIL, MANAGER_PASSWORD);
  return page;
}

/** Juan's tasks and listeners are available only after his workspace is opened. */
async function openJuanWorkspace(page: Page) {
  const open = page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`);
  await expect(open).toBeVisible({ timeout: 30_000 });
  await open.click();
  await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () =>
      page.evaluate(async (clientId) => {
        const { dbService } = await import('/src/services/db.ts');
        const sync = await import('/src/services/firestore/sync.ts');
        const phase = dbService.getClientOperationalPhase(clientId);
        const listeners = sync.activeFirestoreListenerCount();
        const perClient = sync.firestoreRealtimeListenersPerClient();
        return phase === 'READY' && listeners === perClient;
      }, CLIENT_JUAN_ID)
    )
    .toBe(true);
}

async function secondManagerSession(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  return managerSession(await context.newPage());
}

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

test.describe('ADMIN pending mutation integrity', () => {
  test.afterEach(() => {
    const unexpected = externalRequests.filter((url) => !EXTERNAL_FONT.test(url));
    expect(unexpected, 'non-loopback requests other than aborted fonts').toEqual([]);
  });

  test('S1 another writer’s completion survives an ADMIN push of a different task', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = uid();
    const a = await seedTask(`s1a_${stamp}`);
    const b = await seedTask(`s1b_${stamp}`);
    const unrelated = await seedTask(`s1u_${stamp}`);
    await managerSession(page);
    await openJuanWorkspace(page);
    for (const id of [a, b, unrelated]) await waitForLocalDoc(page, 'task', id);
    const unrelatedUpdatedAt = await ownerGetTimestamp(taskPath(unrelated), 'updatedAt');

    await setEvidence(page, a, `https://diag.local/s1-a-${stamp}`);
    const completedAt = new Date().toISOString();
    await foreignReplace(b, { status: 'COMPLETED', completedAt, updatedAt: completedAt });
    await expect.poll(async () => (await localTask(page, b))?.status).toBe('COMPLETED');

    await waitForServerField(taskPath(a), 'evidenceUrl', `https://diag.local/s1-a-${stamp}`);
    await settle([page]);

    expect(await ownerGetField(taskPath(b), 'status')).toBe('COMPLETED');
    expect(await ownerGetTimestamp(taskPath(b), 'completedAt')).not.toBeNull();
    expect(await ownerGetTimestamp(taskPath(unrelated), 'updatedAt')).toBe(unrelatedUpdatedAt);
    expect(await localTask(page, b)).toMatchObject({ status: 'COMPLETED' });
    expect(await localTask(page, a)).toMatchObject({ evidenceUrl: `https://diag.local/s1-a-${stamp}` });
  });

  test('S2 two consecutive ADMIN mutations around a realtime snapshot both persist', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = uid();
    const a = await seedTask(`s2a_${stamp}`);
    const b = await seedTask(`s2b_${stamp}`);
    const c = await seedTask(`s2c_${stamp}`);
    await managerSession(page);
    await openJuanWorkspace(page);
    for (const id of [a, b, c]) await waitForLocalDoc(page, 'task', id);

    await setEvidence(page, a, `https://diag.local/s2-a-${stamp}`);
    await foreignReplace(b, { title: `remote edit ${stamp}` });
    await expect.poll(async () => (await localTask(page, b))?.title).toBe(`remote edit ${stamp}`);
    expect(await localTask(page, a), 'pending mutation kept across the snapshot').toMatchObject({
      evidenceUrl: `https://diag.local/s2-a-${stamp}`,
    });
    await setEvidence(page, c, `https://diag.local/s2-c-${stamp}`);

    await waitForServerField(taskPath(c), 'evidenceUrl', `https://diag.local/s2-c-${stamp}`);
    await waitForServerField(taskPath(a), 'evidenceUrl', `https://diag.local/s2-a-${stamp}`);
    await settle([page]);

    expect(await ownerGetField(taskPath(b), 'title')).toBe(`remote edit ${stamp}`);
    expect(await localTask(page, a)).toMatchObject({ evidenceUrl: `https://diag.local/s2-a-${stamp}` });
    expect(await localTask(page, c)).toMatchObject({ evidenceUrl: `https://diag.local/s2-c-${stamp}` });
  });

  test('S3 two ADMIN sessions changing different tasks both persist and reload correctly', async ({ page, browser }) => {
    test.setTimeout(120_000);
    const stamp = uid();
    const a = await seedTask(`s3a_${stamp}`);
    const b = await seedTask(`s3b_${stamp}`);
    const first = await managerSession(page);
    const second = await secondManagerSession(browser);
    await openJuanWorkspace(first);
    await openJuanWorkspace(second);
    for (const session of [first, second]) for (const id of [a, b]) await waitForLocalDoc(session, 'task', id);

    await setEvidence(first, a, `https://diag.local/s3-a-${stamp}`);
    await setEvidence(second, b, `https://diag.local/s3-b-${stamp}`);

    await waitForServerField(taskPath(a), 'evidenceUrl', `https://diag.local/s3-a-${stamp}`);
    await waitForServerField(taskPath(b), 'evidenceUrl', `https://diag.local/s3-b-${stamp}`);
    await settle([first, second]);

    expect(await ownerGetField(taskPath(a), 'evidenceUrl')).toBe(`https://diag.local/s3-a-${stamp}`);
    expect(await ownerGetField(taskPath(b), 'evidenceUrl')).toBe(`https://diag.local/s3-b-${stamp}`);
    await first.reload();
    await expect(first.locator('[data-testid="react-shell-logout"]')).toBeVisible({ timeout: 30_000 });
    await openJuanWorkspace(first);
    await waitForLocalDoc(first, 'task', a);
    await waitForLocalDoc(first, 'task', b);
    expect(await localTask(first, a)).toMatchObject({ evidenceUrl: `https://diag.local/s3-a-${stamp}` });
    expect(await localTask(first, b)).toMatchObject({ evidenceUrl: `https://diag.local/s3-b-${stamp}` });
  });

  test('S3-conflict a same-field edit from two ADMIN sessions is surfaced, never silently overwritten', async ({ page, browser }) => {
    test.setTimeout(120_000);
    const stamp = uid();
    const a = await seedTask(`s3c_${stamp}`);
    const first = await managerSession(page);
    const second = await secondManagerSession(browser);
    await openJuanWorkspace(first);
    await openJuanWorkspace(second);
    for (const session of [first, second]) await waitForLocalDoc(session, 'task', a);
    const firstValue = `https://diag.local/s3c-first-${stamp}`;
    const secondValue = `https://diag.local/s3c-second-${stamp}`;

    await setEvidence(first, a, firstValue);
    await setEvidence(second, a, secondValue);

    const conflict = /Conflicto de sincronización/;
    await expect
      .poll(
        async () =>
          (await first.getByText(conflict).count()) + (await second.getByText(conflict).count()),
        { timeout: 20_000, message: 'one session reports the conflict' }
      )
      .toBe(1);
    await settle([first, second]);

    const stored = await ownerGetField(taskPath(a), 'evidenceUrl');
    expect([firstValue, secondValue]).toContain(stored);
    expect(await localTask(first, a)).toMatchObject({ evidenceUrl: stored });
    expect(await localTask(second, a)).toMatchObject({ evidenceUrl: stored });
  });

  test('S4 completedTasksCount counts completions from two ADMIN sessions exactly once', async ({ page, browser }) => {
    test.setTimeout(120_000);
    const stamp = uid();
    const a = await seedTask(`s4a_${stamp}`);
    const b = await seedTask(`s4b_${stamp}`);
    const c = await seedTask(`s4c_${stamp}`);
    const d = await seedTask(`s4d_${stamp}`);
    const first = await managerSession(page);
    const second = await secondManagerSession(browser);
    await openJuanWorkspace(first);
    await openJuanWorkspace(second);
    for (const session of [first, second]) for (const id of [a, b, c, d]) await waitForLocalDoc(session, 'task', id);
    const base = (await ownerGetIntegerField(ROOT, 'completedTasksCount')) ?? 0;

    await completeTask(first, a);
    await waitForServerField(taskPath(a), 'status', 'COMPLETED');
    await expect.poll(async () => (await localTask(second, a))?.status).toBe('COMPLETED');
    await completeTask(second, b);
    await waitForServerField(taskPath(b), 'status', 'COMPLETED');

    await completeTask(first, c);
    await completeTask(second, d);
    await waitForServerField(taskPath(c), 'status', 'COMPLETED');
    await waitForServerField(taskPath(d), 'status', 'COMPLETED');
    await settle([first, second]);

    expect(await ownerGetIntegerField(ROOT, 'completedTasksCount')).toBe(base + 4);
    for (const id of [a, b, c, d]) expect(await ownerGetField(taskPath(id), 'status')).toBe('COMPLETED');
  });
});
