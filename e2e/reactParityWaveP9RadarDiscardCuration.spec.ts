/**
 * SPEC-010 · T603 React Parity Wave P9 — bounded ADMIN radar discard / send-to-curation E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

test.describe('P9 — React admin radar discard + send-to-curation parity', () => {
  test('ADMIN discards and sends to curation via RadarPanel without those handoff texts', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).toContainText(
      'puntuar señales'
    );
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).toContainText(
      'investigarlas'
    );
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).not.toContainText(
      'descartarlas'
    );
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).not.toContainText(
      'añadirlas a una entrega'
    );

    const fixture = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const signals = dbService
        .getSignalsByClient(cid)
        .filter((s) => s.status !== 'DISCARDED' && !dbService.isSignalInCuration(cid, s.id));
      const discardTarget = signals[0];
      const curationTarget = signals.find((s) => s.id !== discardTarget?.id) ?? signals[1];
      return {
        discardId: discardTarget?.id ?? null,
        curationId: curationTarget?.id ?? null,
        discardScored: typeof discardTarget?.relevanceScore === 'number',
        curationScored: typeof curationTarget?.relevanceScore === 'number',
      };
    }, { cid: CLIENT_JUAN_ID });

    expect(fixture.discardId).toBeTruthy();
    expect(fixture.curationId).toBeTruthy();
    expect(fixture.discardId).not.toBe(fixture.curationId);

    await page.locator(`[data-testid="react-ws-discard-${fixture.discardId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar-success"]')).toContainText(
      'Señal descartada',
      { timeout: 10_000 }
    );

    const discardedStatus = await page.evaluate(
      async ({ id }) => {
        const { dbService } = await import('/src/services/db.ts');
        return dbService.getSignalById(id)?.status ?? null;
      },
      { id: fixture.discardId }
    );
    expect(discardedStatus).toBe('DISCARDED');

    await page.locator(`[data-testid="react-ws-send-curation-${fixture.curationId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar-success"]')).toContainText(
      'Enviada a curación',
      { timeout: 10_000 }
    );

    const curationState = await page.evaluate(
      async ({ cid, id }) => {
        const { dbService } = await import('/src/services/db.ts');
        const signal = dbService.getSignalById(id);
        return {
          inCuration: dbService.isSignalInCuration(cid, id),
          status: signal?.status ?? null,
          score: typeof signal?.relevanceScore === 'number' ? signal.relevanceScore : null,
        };
      },
      { cid: CLIENT_JUAN_ID, id: fixture.curationId }
    );
    expect(curationState.inCuration).toBe(true);
    expect(curationState.status).toBe('SAVED');
    if (!fixture.curationScored) {
      expect(curationState.score).not.toBeNull();
    }

    await expect(
      page.locator(`[data-testid="react-ws-send-curation-${fixture.curationId}"]`)
    ).toHaveCount(0);
  });
});
