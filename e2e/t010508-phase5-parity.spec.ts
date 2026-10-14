/**
 * SPEC-010 T-010-508 — Playwright legacy-vs-React parity journeys + rollback.
 *
 * Uses deterministic demo credentials (docs/ops/pilot.md). No production auth bypass.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  businessSnapshot,
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  enterClientWorkspaceFromShell,
  loginAsClientElena,
  loginAsClientJuan,
  MANAGER_EMAIL,
  MANAGER_PASSWORD,
  openManagerWorkspace,
  readAuthenticatedClientProjection,
  rollbackStableSnapshot,
  sidebarTab,
  UI_MODE_KEY,
  visibleRoots,
  waitForAuthenticatedClientProjection,
} from './helpers/spec010Auth';
import {
  FIXTURE_ORG_ID,
  loginClientWithSettledSession,
  ownerListStringFields,
  ownerSeedDoc,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

const BRIEF_HISTORY_KEY = 'postura_strategic_brief_history_v1';

/**
 * Server-side Strategic Brief record the ADMIN session must hydrate, so the Brief cache is
 * always written during session sync — even when no earlier spec left Briefs behind.
 */
const T508_BRIEF_HISTORY_FIXTURE = {
  briefId: 'brief_t508_hydration_fixture',
  version: 1,
  status: 'DRAFT',
  decision: {
    authorizedAction: 'CREATE_CONTENT',
    dispositionDecision: 'SAVE',
    formatDecision: 'ARTICLE',
    decisionRationale: 'T508 deterministic Strategic Brief hydration fixture.',
    upstreamRoutingRef: { routingState: 'CLEAR' },
    upstreamScoreRef: { scoringVersion: 'scoring-v1' },
    signalContextRefs: [],
  },
  organizationId: FIXTURE_ORG_ID,
  clientId: CLIENT_JUAN_ID,
  actorId: 'user_admin_01',
  source: 'HUMAN',
  changeType: 'CREATED',
  changedAt: '2026-01-01T00:00:00.000Z',
  materialFingerprint: 't508-hydration-fixture-v1',
};

/** OWNER seed (emulator only) at the doc id the app derives, so hydration never re-uploads it. */
async function seedBriefHistoryFixture(page: Page) {
  await page.goto('/');
  const docId = await page.evaluate(async (entry) => {
    const { strategicBriefHistoryDocId } = await import('/src/services/firestore/strategicBriefSync.ts');
    return strategicBriefHistoryDocId(entry);
  }, T508_BRIEF_HISTORY_FIXTURE);
  await ownerSeedDoc(`clients/${CLIENT_JUAN_ID}/strategicBriefHistory/${docId}`, T508_BRIEF_HISTORY_FIXTURE);
}

/**
 * Manager workspace whose session sync — Firestore hydration, realtime start and Strategic
 * Brief hydration — has completed, so the stable baseline already holds the hydrated Brief cache.
 */
async function openSettledManagerWorkspace(page: Page) {
  await seedBriefHistoryFixture(page);
  await loginClientWithSettledSession(page, MANAGER_EMAIL, MANAGER_PASSWORD);
  await enterClientWorkspaceFromShell(page);
  await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();

  const local = await page.evaluate(
    ([key]) => {
      const raw = localStorage.getItem(key);
      const entries: Array<{ briefId?: string }> = raw ? JSON.parse(raw).entries ?? [] : [];
      const briefsRaw = localStorage.getItem('postura_strategic_brief_v1');
      const briefs: Array<{ id?: string }> = briefsRaw ? JSON.parse(briefsRaw).briefs ?? [] : [];
      return { historyBriefIds: entries.map((entry) => entry.briefId), briefIds: briefs.map((brief) => brief.id) };
    },
    [BRIEF_HISTORY_KEY]
  );
  expect(local.historyBriefIds).toContain(T508_BRIEF_HISTORY_FIXTURE.briefId);
  const serverBriefIds = (await ownerListStringFields(`clients/${CLIENT_JUAN_ID}/strategicBriefs`)).map(
    (fields) => fields.id
  );
  expect(local.briefIds).toEqual(expect.arrayContaining(serverBriefIds));
}

/** Option E mid-journey legacy request, then React reload with the session restored. */
async function runMidJourneyRollback(page: Page) {
  await expect(page.locator('[data-testid="react-shell-to-legacy"]')).toHaveCount(0);
  await page.evaluate(async () => {
    const ui = (
      window as unknown as {
        __posturaUi?: { applyUiMode?: (mode: 'legacy' | 'react') => Promise<void> };
      }
    ).__posturaUi;
    if (!ui?.applyUiMode) throw new Error('Strangler controls are unavailable');
    await ui.applyUiMode('legacy');
  });
  await expect
    .poll(() => page.evaluate(([key]) => localStorage.getItem(key), [UI_MODE_KEY]))
    .toBe('legacy');
  await expect(page.locator('html')).toHaveAttribute('data-postura-ui', 'react');
  await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
  expect(await visibleRoots(page)).toEqual(['react-root']);

  await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
  await page.reload();

  // Main-world only: never use waitForFunction + dynamic import for auth state.
  type MainWorldAuth = { uid: string; reactLogin: boolean; reactLogout: boolean };
  let mainWorld: MainWorldAuth | null = null;
  await expect
    .poll(async () => {
      mainWorld = await page.evaluate(async () => {
        const { authService } = await import('/src/services/auth.ts');
        await authService.ready;
        const user = authService.getCurrentUser();
        const reactLogin = !!document.querySelector('[data-testid="react-login"]');
        const reactLogout = !!document.querySelector('[data-testid="react-shell-logout"]');
        if (!user || !reactLogout || reactLogin) return null;
        return {
          uid: user.uid,
          reactLogin,
          reactLogout,
        };
      });
      return mainWorld;
    }, { timeout: 30_000 })
    .not.toBeNull();

  expect(mainWorld).not.toBeNull();
  expect(mainWorld!.uid).toBeTruthy();
  expect(mainWorld!.reactLogout).toBe(true);
  expect(mainWorld!.reactLogin).toBe(false);
  await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible();
  await expect(page.locator('[data-testid="react-login"]')).toHaveCount(0);
}

function changedKeys(before: Record<string, string>, after: Record<string, string>): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => before[key] !== after[key])
    .sort();
}

test.describe('T-010-508 — authenticated manager journey', () => {
  test('manager cockpit and workspace navigation stay React-owned', async ({ page }) => {
    await openManagerWorkspace(page);
    await sidebarTab(page, 'clients').click();
    await expect(page.locator('[data-testid="react-manager-cockpit"]')).toBeVisible();
    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });
});

test.describe('T-010-508 — authenticated client journey', () => {
  test('client portal renders under React shell', async ({ page }) => {
    await loginAsClientJuan(page);
    await expect(page.locator('[data-testid="react-client-portal"]')).toBeVisible({ timeout: 15_000 });
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });
});

test.describe('T-010-508 — hybrid pages and legacy islands', () => {
  test('React hosts legacy briefing island with single shell authority', async ({ page }) => {
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    const island = page.locator('[data-testid="react-legacy-island"]');
    await expect(island).toBeVisible();
    await expect(island).toHaveAttribute('data-legacy-island-tab', 'ws-briefing');
    await expect(page.locator('#app .sidebar')).toHaveCount(0);
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });

  test('legacy island returns to React-native radar', async ({ page }) => {
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    await page.locator('[data-legacy-island="true"] button[data-tab="ws-radar"]').first().click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toHaveCount(0);
  });
});

test.describe('T-010-508 — React ↔ legacy rollback', () => {
  test('mid-journey rollback leaves stable business storage unchanged', async ({ page }) => {
    test.setTimeout(90_000);
    await openSettledManagerWorkspace(page);
    const before = await rollbackStableSnapshot(page);
    expect(before[BRIEF_HISTORY_KEY]).toContain(T508_BRIEF_HISTORY_FIXTURE.briefId);

    // Option E: the mid-journey legacy request is persisted, but React stays served.
    await runMidJourneyRollback(page);

    expect(await rollbackStableSnapshot(page)).toEqual(before);
  });

  test('stable-storage comparison still fails on a real business change after rollback', async ({ page }) => {
    test.setTimeout(90_000);
    await openSettledManagerWorkspace(page);
    const before = await rollbackStableSnapshot(page);
    await runMidJourneyRollback(page);
    expect(await rollbackStableSnapshot(page)).toEqual(before);

    await page.evaluate(([key]) => {
      const envelope = JSON.parse(localStorage.getItem(key) ?? '{}');
      envelope.entries = (envelope.entries ?? []).map((entry: { status?: string }) => ({ ...entry, status: 'APPROVED' }));
      localStorage.setItem(key, JSON.stringify(envelope));
    }, [BRIEF_HISTORY_KEY]);
    const tampered = await rollbackStableSnapshot(page);
    expect(tampered).not.toEqual(before);
    expect(changedKeys(before, tampered)).toEqual([BRIEF_HISTORY_KEY]);

    await page.evaluate(() => {
      const notifications: Array<Record<string, unknown>> = JSON.parse(
        localStorage.getItem('postura_notifications_v4') ?? '[]'
      );
      notifications.push({ id: 'ntf_t508_tamper', title: 'Injected', body: 'Not part of rollback', read: false });
      localStorage.setItem('postura_notifications_v4', JSON.stringify(notifications));
    });
    expect(changedKeys(before, await rollbackStableSnapshot(page))).toEqual(
      ['postura_notifications_v4', BRIEF_HISTORY_KEY].sort()
    );
  });

  test('explicit legacy request keeps React served without data migration', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);
    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-postura-ui', 'react');
    await expect(page.locator('#react-root')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);
    expect(await businessSnapshot(page)).toEqual(before);
  });
});

test.describe('T-010-508 — cross-tenant isolation', () => {
  test('two client sessions see distinct portal scopes', async ({ page }) => {
    await loginAsClientJuan(page);
    await waitForAuthenticatedClientProjection(page, CLIENT_JUAN_ID);
    const juan = await readAuthenticatedClientProjection(page);
    const juanText = await page.locator('[data-testid="react-client-portal"]').innerText();
    expect(juan.clientId).toBe(CLIENT_JUAN_ID);
    expect(juan.hydratedOwnClientRecord).toBe(true);
    expect(juan.clientIds).not.toContain(CLIENT_ELENA_ID);

    await page.locator('[data-testid="react-shell-logout"]').click();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();

    await loginAsClientElena(page);
    await waitForAuthenticatedClientProjection(page, CLIENT_ELENA_ID);
    const elena = await readAuthenticatedClientProjection(page);
    const elenaText = await page.locator('[data-testid="react-client-portal"]').innerText();
    expect(elena.clientId).toBe(CLIENT_ELENA_ID);
    expect(elena.hydratedOwnClientRecord).toBe(true);
    expect(elena.clientIds).not.toContain(CLIENT_JUAN_ID);
    for (const title of juan.taskTitles) {
      expect(elenaText).not.toContain(title);
    }
    expect(juanText).not.toEqual(elenaText);
  });
});

test.describe('T-010-508 — governed available MVP journey', () => {
  test('Client → workspace radar → briefs → deliver → result handoff (Planner unreachable)', async ({
    page,
  }) => {
    await openManagerWorkspace(page);

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();

    await sidebarTab(page, 'ws-briefs').click();
    await expect(page.locator('[data-testid="react-ws-briefs"]')).toBeVisible();

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible();

    await sidebarTab(page, 'ws-tasks').click();
    await expect(page.locator('[data-testid="react-ws-tasks"]')).toBeVisible();

    await expect(page.locator('[data-testid="react-ws-plan"]')).toHaveCount(0);
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });
});
