/**
 * SPEC-010 · T603 React Parity Wave P13 — bounded ADMIN delivery assembly E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

test.describe('P13 — React admin delivery assembly parity', () => {
  test('ADMIN assembles draft briefing without deliver handoff', async ({ page }) => {
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
          totalScore: 84,
          priorityBand: 'HIGH',
          factors: {} as never,
          penalties: {} as never,
          strategicRationale: 'E2E P13 governed routing fixture.',
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
          strategicRationale: 'E2E P13 governed score fixture.',
          recommendedAction: 'CURATE',
          scoringStatus: 'SCORED',
          scoringVersion: 'scoring-v1',
          recommendedDisposition: 'SAVE',
          recommendedOutputFormat: 'ARTICLE',
          calculatedAt: new Date().toISOString(),
        },
        {
          whyNow: { reason: 'E2E P13 timely governed context', score: 10 },
        }
      );

      const { addSignalToCuration, decideCuration } = await import(
        '/src/services/executionDeliveryConsumer.ts'
      );
      const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
      decideCuration({
        requestedClientId: cid,
        curationEntryId: added.entry.id,
        destination: 'TASK_VIDEO',
        rationale: 'E2E P13 decided ready row for assembly.',
      });

      const entry = dbService.getCurationById(added.entry.id);
      if (entry?.deliveryPackageId) {
        dbService.attachCurationToDelivery(added.entry.id, null);
      }

      const existingDraft = dbService.getDraftDelivery(cid);
      if (existingDraft) {
        dbService.discardDraftDelivery(existingDraft.id);
      }

      const ready = dbService.getReadyCurationByClient(cid).some((row) => row.id === added.entry.id);
      return {
        curationId: added.entry.id,
        thesisResolved: true,
        ready,
      };
    }, { cid: CLIENT_JUAN_ID });

    expect(fixture.curationId).toBeTruthy();
    expect(fixture.thesisResolved).toBe(true);
    expect(fixture.ready).toBe(true);

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).toHaveCount(0);

    await page.locator('[data-testid="react-ws-ensure-draft"]').click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Briefing creado'
    );
    await expect(page.locator('[data-testid="react-ws-draft-package"]')).toBeVisible();

    const curationId = fixture.curationId!;
    const addButton = page.locator(`[data-testid="react-ws-add-to-briefing-${curationId}"]`);
    if (await addButton.count()) {
      await addButton.click();
      await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
        'Añadido al briefing'
      );
    }

    await page.fill('[data-testid="react-ws-draft-title"]', 'Briefing E2E P13');
    await page.fill('[data-testid="react-ws-draft-strategic-note"]', 'Nota estratégica E2E');
    await page.locator('[data-testid="react-ws-draft-save-metadata"]').click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Nota estratégica guardada'
    );

    await expect(page.locator('[data-testid="react-ws-draft-items"] li')).not.toHaveCount(0);
    await expect(page.locator('[data-testid="react-ws-deliver-preview-send"]')).toBeEnabled();
  });

  test('ADMIN discards draft briefing with authoritative refresh', async ({ page }) => {
    test.setTimeout(120_000);
    await openManagerWorkspace(page);

    await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const existingDraft = dbService.getDraftDelivery(cid);
      if (existingDraft) dbService.discardDraftDelivery(existingDraft.id);
      dbService.ensureDraftDelivery(cid, 'e2e_p13');
    }, { cid: CLIENT_JUAN_ID });

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-draft-package"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('[data-testid="react-ws-discard-draft"]').click();
    await expect(page.locator('[data-testid="react-ws-discard-confirm"]')).toBeVisible();
    await page.locator('[data-testid="react-ws-discard-confirm-yes"]').click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Borrador descartado'
    );
    await expect(page.locator('[data-testid="react-ws-draft-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-ws-ensure-draft"]')).toBeVisible();
  });
});
