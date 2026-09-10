/**
 * SPEC-010 · T603 React Parity Wave P11 — bounded ADMIN propose-angle E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

test.describe('P11 — React admin propose angle parity', () => {
  test('ADMIN proposes angle on ready curation row without propose-angle handoff text', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openManagerWorkspace(page);

    const fixture = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const thesis = dbService.getActiveTheses(cid)[0];
      if (!thesis) return { curationId: null as string | null, thesisResolved: false };

      const signal = dbService
        .getSignalsByClient(cid)
        .find((s) => s.status !== 'DISCARDED' && !dbService.isSignalInCuration(cid, s.id));
      if (!signal) return { curationId: null, thesisResolved: false };

      dbService.applyStrategicRoutingToSignal(
        signal.id,
        {
          totalScore: 82,
          priorityBand: 'HIGH',
          factors: {} as never,
          penalties: {} as never,
          strategicRationale: 'E2E P11 governed routing fixture.',
          recommendedAction: 'CURATE',
          scoringStatus: 'SCORED',
          calculatedAt: new Date().toISOString(),
        },
        {
          thesisId: thesis.id,
          thesisScores: [{ thesisId: thesis.id, score: 82, rationale: 'E2E' }],
          routingDecision: { routingState: 'CLEAR', selectedThesisId: thesis.id },
          clientId: cid,
        }
      );

      const { addSignalToCuration, decideCuration } = await import(
        '/src/services/executionDeliveryConsumer.ts'
      );
      const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
      decideCuration({
        requestedClientId: cid,
        curationEntryId: added.entry.id,
        destination: 'EVIDENCE',
        rationale: 'E2E P11 decided ready row with governed thesis routing context.',
      });

      const entry = dbService.getCurationById(added.entry.id);
      if (entry?.deliveryPackageId) {
        dbService.attachCurationToDelivery(added.entry.id, null);
      }

      const ready = dbService.getReadyCurationByClient(cid).some((row) => row.id === added.entry.id);
      return {
        curationId: added.entry.id,
        thesisResolved: true,
        ready,
        hasAngle: Boolean(entry?.aiAngle),
      };
    }, { cid: CLIENT_JUAN_ID });

    expect(fixture.curationId).toBeTruthy();
    expect(fixture.thesisResolved).toBe(true);
    expect(fixture.ready).toBe(true);
    expect(fixture.hasAngle).toBe(false);

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).not.toContainText(
      'proponer ángulo'
    );
    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).toContainText(
      'crear el Strategic Brief'
    );

    const curationId = fixture.curationId!;
    await expect(page.locator(`[data-testid="react-ws-ready-${curationId}"]`)).toBeVisible();
    await page.locator(`[data-testid="react-ws-propose-angle-${curationId}"]`).click();

    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      /Ángulo propuesto/,
      { timeout: 30_000 }
    );

    await expect(page.locator(`[data-testid="react-ws-angle-${curationId}"]`)).toBeVisible({
      timeout: 15_000,
    });

    const persisted = await page.evaluate(
      async ({ id }) => {
        const { dbService } = await import('/src/services/db.ts');
        const entry = dbService.getCurationById(id);
        return entry?.aiAngle ?? null;
      },
      { id: curationId }
    );
    expect(persisted).toBeTruthy();
  });

  test('THESIS_NOT_RESOLVED shows exact legacy warning on ready row', async ({ page }) => {
    test.setTimeout(120_000);
    await openManagerWorkspace(page);

    const fixture = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const signal = dbService
        .getSignalsByClient(cid)
        .find(
          (s) =>
            s.status !== 'DISCARDED' &&
            !dbService.isSignalInCuration(cid, s.id) &&
            !s.routingDecision?.selectedThesisId
        );
      if (!signal) return { curationId: null as string | null };

      const { addSignalToCuration, decideCuration } = await import(
        '/src/services/executionDeliveryConsumer.ts'
      );
      const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
      decideCuration({
        requestedClientId: cid,
        curationEntryId: added.entry.id,
        destination: 'EVIDENCE',
        rationale: 'E2E P11 unresolved thesis fixture for warning path.',
      });
      const entry = dbService.getCurationById(added.entry.id);
      if (entry?.deliveryPackageId) {
        dbService.attachCurationToDelivery(added.entry.id, null);
      }
      return { curationId: added.entry.id };
    }, { cid: CLIENT_JUAN_ID });

    expect(fixture.curationId).toBeTruthy();

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
      timeout: 15_000,
    });

    const curationId = fixture.curationId!;
    await page.locator(`[data-testid="react-ws-propose-angle-${curationId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-deliver-warning-msg"]')).toContainText(
      'Routing must be resolved first — create a Strategic Brief or ensure CLEAR governed routing.',
      { timeout: 15_000 }
    );
  });
});
