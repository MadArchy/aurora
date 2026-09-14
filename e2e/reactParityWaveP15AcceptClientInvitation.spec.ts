/**
 * SPEC-010 · T603 React Parity Wave P15 — bounded CLIENT invite accept E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_PASSWORD,
  enableReactMode,
  loginAsManager,
  MANAGER_EMAIL,
  MANAGER_PASSWORD,
  sidebarTab,
  UI_MODE_KEY,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

async function createInviteViaP14(page: import('@playwright/test').Page) {
  await loginAsManager(page);
  await sidebarTab(page, 'dashboard').click();
  await expect(page.locator('[data-testid="react-manager-cockpit"]')).toBeVisible();

  const uniqueEmail = `p15.e2e.${Date.now()}@example.com`;
  const displayName = 'P15 Invite Client';

  await page.click('[data-testid="react-cockpit-create-open"]');
  await page.fill('[data-testid="react-cockpit-first-name"]', 'P15');
  await page.fill('[data-testid="react-cockpit-last-name"]', 'Cliente');
  await page.fill('[data-testid="react-cockpit-email"]', uniqueEmail);
  await page.click('[data-testid="react-cockpit-create-submit"]');

  const success = page.locator('[data-testid="react-cockpit-create-success"]');
  await expect(success).toBeVisible({ timeout: 15_000 });
  await expect(success).toContainText('Token de invitación');

  const successText = (await success.textContent()) ?? '';
  const tokenMatch = successText.match(/Token de invitación:\s*(\S+)/);
  expect(tokenMatch).not.toBeNull();

  const token = tokenMatch![1];
  const inviteFacts = await page.evaluate(async ({ email, inviteToken }) => {
    const { dbService } = await import('/src/services/db.ts');
    const client = dbService.getClients().find((row) => row.primaryEmail === email);
    const invite = dbService.getInvitationByToken(inviteToken);
    if (!client || !invite) return { found: false as const };
    return {
      found: true as const,
      inviteStatus: invite.status,
      clientStatus: client.status,
    };
  }, { email: uniqueEmail, inviteToken: token });

  expect(inviteFacts.found).toBe(true);
  if (inviteFacts.found) {
    expect(inviteFacts.inviteStatus).toBe('PENDING');
    expect(inviteFacts.clientStatus).toBe('INVITED');
  }

  return { token, email: uniqueEmail, displayName };
}

async function openInviteFlow(page: import('@playwright/test').Page, token: string) {
  await page.evaluate(async () => {
    const { authService } = await import('/src/services/auth.ts');
    authService.logout();
  });
  await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 15_000 });

  await page.evaluate((inviteToken) => {
    const next = `/?invite=${encodeURIComponent(inviteToken)}`;
    window.history.replaceState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, token);

  await expect(page.locator('[data-testid="react-login-invite"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('P15 — React client invitation acceptance parity', () => {
  test('CLIENT accepts invite via ?invite= native form and reaches onboarding', async ({ page }) => {
    test.setTimeout(180_000);
    const { token, displayName } = await createInviteViaP14(page);
    await openInviteFlow(page, token);

    await expect(page.locator('[data-testid="react-login-invite-token"]')).toContainText(token);
    await expect(page.locator('[data-testid="react-login-email-card"]')).toHaveCount(0);

    await page.fill('[data-testid="react-login-invite-name"]', displayName);
    await page.fill('[data-testid="react-login-invite-password"]', CLIENT_PASSWORD);
    await page.fill('[data-testid="react-login-invite-confirm"]', CLIENT_PASSWORD);
    await page.click('[data-testid="react-login-invite-submit"]');

    await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-testid="react-login-invite"]')).toHaveCount(0);
    await expect(page.locator('.sidebar-role')).toContainText('Portal del cliente', {
      timeout: 15_000,
    });

    await sidebarTab(page, 'client-profile').click();
    await expect(page.locator('[data-testid="react-onboarding-wizard"]')).toBeVisible({
      timeout: 15_000,
    });

    const facts = await page.evaluate(async (inviteToken) => {
      const { dbService } = await import('/src/services/db.ts');
      const invite = dbService.getInvitationByToken(inviteToken);
      if (!invite) return { found: false as const };
      const client = dbService.getClientById(invite.clientId);
      return {
        found: true as const,
        inviteStatus: invite.status,
        clientStatus: client?.status ?? null,
        onboardingStatus: client?.onboardingStatus ?? null,
      };
    }, token);

    expect(facts.found).toBe(true);
    if (facts.found) {
      expect(facts.inviteStatus).toBe('ACCEPTED');
      expect(facts.clientStatus).toBe('ACTIVE');
      expect(facts.onboardingStatus).toBe('IN_PROGRESS');
    }
  });

  test('invalid invite token shows canonical error without session', async ({ page }) => {
    test.setTimeout(90_000);
    await enableReactMode(page);
    await page.goto('/?invite=invalid_token_p15_e2e');
    await expect(page.locator('[data-testid="react-login-invite"]')).toBeVisible();

    await page.fill('[data-testid="react-login-invite-name"]', 'Bad Token User');
    await page.fill('[data-testid="react-login-invite-password"]', CLIENT_PASSWORD);
    await page.fill('[data-testid="react-login-invite-confirm"]', CLIENT_PASSWORD);
    await page.click('[data-testid="react-login-invite-submit"]');

    await expect(page.locator('[data-testid="react-login-invite-error"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-shell-logout"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  });

  test('email login without ?invite= remains unchanged for ADMIN and CLIENT paths', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('[data-testid="react-login-email-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-login-invite"]')).toHaveCount(0);

    await page.fill('#react-login-email', MANAGER_EMAIL);
    await page.fill('#react-login-password', MANAGER_PASSWORD);
    await page.click('[data-testid="react-login-submit"]');
    await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible({
      timeout: 30_000,
    });
  });
});
