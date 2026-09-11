/**
 * SPEC-010 · T603 React Parity Wave P12 — bounded ADMIN brief-create E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

test.describe('P12 — React admin create strategic brief parity', () => {
  test('ADMIN creates DRAFT brief on ready curation row without brief-create handoff text', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openManagerWorkspace(page);

    const fixture = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      for (const pkg of dbService.getDeliveriesByClient(cid)) {
        if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
      }
      const draftCount = dbService
        .getDeliveriesByClient(cid)
        .filter((d) => d.status === 'DRAFT').length;
      const thesis = dbService.getActiveTheses(cid)[0];
      if (!thesis) return { curationId: null as string | null, thesisResolved: false };

      const signal = dbService
        .getSignalsByClient(cid)
        .find((s) => s.status !== 'DISCARDED' && !dbService.isSignalInCuration(cid, s.id));
      if (!signal) return { curationId: null, thesisResolved: false };

      dbService.applyStrategicRoutingToSignal(
        signal.id,
        {
          totalScore: 84,
          priorityBand: 'HIGH',
          factors: {} as never,
          penalties: {} as never,
          strategicRationale: 'E2E P12 governed routing fixture.',
          recommendedAction: 'CURATE',
          scoringStatus: 'SCORED',
          calculatedAt: new Date().toISOString(),
        },
        {
          thesisId: thesis.id,
          thesisScores: [{ thesisId: thesis.id, score: 84, rationale: 'E2E' }],
          routingDecision: { routingState: 'CLEAR', selectedThesisId: thesis.id },
          clientId: cid,
        }
      );
      dbService.applyScoreToSignal(
        signal.id,
        {
          totalScore: 84,
          priorityBand: 'HIGH',
          factors: {} as never,
          penalties: {} as never,
          strategicRationale: 'E2E P12 governed score fixture.',
          recommendedAction: 'CURATE',
          scoringStatus: 'SCORED',
          scoringVersion: 'scoring-v1',
          recommendedDisposition: 'SAVE',
          recommendedOutputFormat: 'ARTICLE',
          calculatedAt: new Date().toISOString(),
        },
        {
          whyNow: { reason: 'E2E P12 timely governed context', score: 10 },
        }
      );

      const { addSignalToCuration, decideCuration } = await import(
        '/src/services/executionDeliveryConsumer.ts'
      );
      const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
      decideCuration({
        requestedClientId: cid,
        curationEntryId: added.entry.id,
        destination: 'TASK_ARTICLE',
        rationale: 'E2E P12 decided ready row with Brief-eligible destination.',
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
        hasBrief: Boolean(entry?.strategicBriefId),
        draftCount,
      };
    }, { cid: CLIENT_JUAN_ID });

    expect(fixture.curationId).toBeTruthy();
    expect(fixture.thesisResolved).toBe(true);
    expect(fixture.ready).toBe(true);
    expect(fixture.hasBrief).toBe(false);
    expect(fixture.draftCount).toBe(0);

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-ws-ensure-draft"]')).toBeVisible();

    const curationId = fixture.curationId!;
    await expect(page.locator(`[data-testid="react-ws-ready-${curationId}"]`)).toBeVisible();
    await page.locator(`[data-testid="react-ws-create-brief-${curationId}"]`).click();

    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      /Strategic Brief DRAFT created/,
      { timeout: 30_000 }
    );

    await expect(page.locator(`[data-testid="react-ws-ready-${curationId}"]`)).toContainText(
      'con Brief',
      { timeout: 15_000 }
    );

    const persisted = await page.evaluate(
      async ({ id }) => {
        const { dbService } = await import('/src/services/db.ts');
        const entry = dbService.getCurationById(id);
        return entry?.strategicBriefId ?? null;
      },
      { id: curationId }
    );
    expect(persisted).toBeTruthy();
  });

  test('missing governed thesis/routing shows failure feedback on Brief create', async ({
    page,
  }) => {
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
        destination: 'TASK_ARTICLE',
        rationale: 'E2E P12 unresolved thesis fixture for brief failure path.',
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
    await page.locator(`[data-testid="react-ws-create-brief-${curationId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-deliver-warning-msg"]')).toBeVisible({
      timeout: 15_000,
    });
  });
});
