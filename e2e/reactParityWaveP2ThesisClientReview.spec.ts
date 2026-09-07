/**
 * SPEC-010 · T603 React Parity Wave P2 — bounded client thesis review E2E.
 */
import { expect, test } from '@playwright/test';
import { loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';
import { THESIS_GOVERNANCE_REVIEW } from '../src/data/juanCampaignSeed';

test.use({ channel: 'chrome' });

test.describe('P2 §36 — React client portal thesis review', () => {
  test('CLIENT reviews pending thesis on combined client-thesis surface', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsClientJuan(page);
    await sidebarTab(page, 'client-thesis').click();

    await expect(page.locator('[data-testid="react-client-portal"][data-portal-tab="thesis"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-portal-thesis"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-dossier-panel"]')).toBeVisible();

    await page.selectOption('[data-testid="react-portal-thesis-select"]', THESIS_GOVERNANCE_REVIEW);
    await expect(page.locator('[data-testid="react-portal-thesis-approve"]')).toBeVisible();
    await page.click('[data-testid="react-portal-thesis-approve"]');

    await expect(page.locator('[data-testid="react-portal-thesis-success"]')).toHaveText(
      'Tesis aprobada. Tu Brand Manager la activará.'
    );
    await expect(page.locator('[data-testid="react-portal-thesis-approved-info"]')).toBeVisible();

    const stored = await page.evaluate(async ({ thesisId }) => {
      const { dbService } = await import('/src/services/db.ts');
      const thesis = dbService.getThesesByClient('client_juan_001').find((row) => row.id === thesisId);
      return thesis
        ? { status: thesis.status, clientApprovalStatus: thesis.clientApprovalStatus }
        : null;
    }, { thesisId: THESIS_GOVERNANCE_REVIEW });

    expect(stored).toEqual({ status: 'UNDER_REVIEW', clientApprovalStatus: 'APPROVED' });
  });
});
