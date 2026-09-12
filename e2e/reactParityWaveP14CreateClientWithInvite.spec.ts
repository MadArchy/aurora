/**
 * SPEC-010 · T603 React Parity Wave P14 — bounded ADMIN create-client E2E.
 */
import { expect, test } from '@playwright/test';
import { loginAsManager, sidebarTab } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

test.describe('P14 — React admin create client with invite parity', () => {
  test('ADMIN creates client via native cockpit form and portfolio refresh', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsManager(page);
    await sidebarTab(page, 'dashboard').click();
    await expect(page.locator('[data-testid="react-manager-cockpit"]')).toBeVisible();

    const uniqueEmail = `p14.e2e.${Date.now()}@example.com`;
    const firstName = 'P14';
    const lastName = 'Cliente';

    await page.click('[data-testid="react-cockpit-create-open"]');
    await page.fill('[data-testid="react-cockpit-first-name"]', firstName);
    await page.fill('[data-testid="react-cockpit-last-name"]', lastName);
    await page.fill('[data-testid="react-cockpit-email"]', uniqueEmail);
    await page.fill('[data-testid="react-cockpit-profession"]', 'Consultor');
    await page.click('[data-testid="react-cockpit-create-submit"]');

    const success = page.locator('[data-testid="react-cockpit-create-success"]');
    await expect(success).toBeVisible({ timeout: 15_000 });
    await expect(success).toContainText('Token de invitación');

    await page.fill('[data-testid="react-cockpit-search"]', firstName);
    await expect(page.locator('[data-testid="react-cockpit-queue"]')).toContainText(`${firstName} ${lastName}`, {
      timeout: 15_000,
    });

    const successText = (await success.textContent()) ?? '';
    const tokenMatch = successText.match(/Token de invitación:\s*(\S+)/);
    expect(tokenMatch).not.toBeNull();

    const inviteFacts = await page.evaluate(async ({ email, token }) => {
      const { dbService } = await import('/src/services/db.ts');
      const client = dbService.getClients().find((row) => row.primaryEmail === email);
      const invite = dbService.getInvitationByToken(token);
      if (!client || !invite) return { found: false as const };
      return {
        found: true as const,
        clientStatus: client.status,
        onboardingStatus: client.onboardingStatus,
        inviteStatus: invite.status,
        inviteClientId: invite.clientId,
      };
    }, { email: uniqueEmail, token: tokenMatch![1] });

    expect(inviteFacts.found).toBe(true);
    if (inviteFacts.found) {
      expect(inviteFacts.clientStatus).toBe('INVITED');
      expect(inviteFacts.onboardingStatus).toBe('NOT_STARTED');
      expect(inviteFacts.inviteStatus).toBe('PENDING');
    }

    await expect(page.locator('[data-testid="react-cockpit-handoff"]')).not.toContainText(
      'crear un cliente'
    );
    await expect(page.locator('[data-testid="react-cockpit-handoff"]')).not.toContainText(
      'invitarlo'
    );
  });

  test('client-side validation rejects empty required fields without handoff delegation', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAsManager(page);
    await sidebarTab(page, 'dashboard').click();
    await page.click('[data-testid="react-cockpit-create-open"]');
    await page.click('[data-testid="react-cockpit-create-submit"]');
    await expect(page.locator('[data-testid="react-cockpit-create-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-cockpit-create-error"]')).toContainText(
      'obligatorios'
    );
  });
});
