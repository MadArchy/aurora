/**
 * SPEC-010 · T603 React Parity Wave P5 — bounded manager thesis save E2E.
 */
import { expect, test } from '@playwright/test';
import {
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';
import { THESIS_GOVERNANCE_REVIEW } from '../src/data/juanCampaignSeed';

test.use({ channel: 'chrome' });

test.describe('P5 — React manager thesis save/activate parity', () => {
  test('ADMIN saves draft on ReactThesisEditorPage without #11 legacy handoff', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-positioning').click();

    await expect(page.locator('[data-testid="react-client-workspace"][data-workspace-tab="positioning"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-thesis-editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-thesis-editor-handoff"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-thesis-editor-handoff"]')).toContainText(
      'stress-test'
    );
    await expect(page.locator('[data-testid="react-thesis-editor-handoff"]')).not.toContainText(
      'guardar la tesis'
    );

    await page.selectOption('[data-testid="react-thesis-select"]', THESIS_GOVERNANCE_REVIEW);
    await expect(page.locator('[data-testid="react-thesis-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-thesis-save"]')).toBeEnabled();
    await expect(page.locator('[data-testid="react-thesis-submit"]')).toBeEnabled();

    const titleInput = page.locator('#react-thesis-title');
    await titleInput.fill('Gobernanza IA para consejos y comités (P5 draft)');
    await page.click('[data-testid="react-thesis-save"]');

    await expect(page.locator('[data-testid="react-thesis-success"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="react-thesis-success"]')).toContainText(/Borrador|guardado/i);

    const stored = await page.evaluate(async ({ thesisId }) => {
      const { dbService } = await import('/src/services/db.ts');
      const thesis = dbService.getThesesByClient('client_juan_001').find((row) => row.id === thesisId);
      return thesis
        ? {
            title: thesis.title,
            status: thesis.status,
            clientApprovalStatus: thesis.clientApprovalStatus,
          }
        : null;
    }, { thesisId: THESIS_GOVERNANCE_REVIEW });

    expect(stored).toEqual({
      title: 'Gobernanza IA para consejos y comités (P5 draft)',
      status: 'DRAFT',
      clientApprovalStatus: 'PENDING',
    });

    await expect(page.locator('[data-testid="react-thesis-status"]')).toContainText('DRAFT');
  });
});
