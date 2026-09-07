/**
 * SPEC-010 · T603 React Parity Wave P1 — bounded client delivery acknowledgement E2E.
 */
import { expect, test } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

async function seedSentBriefing(page: import('@playwright/test').Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    for (const pkg of dbService.getDeliveriesByClient(cid)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }
    const pkg = dbService.ensureDraftDelivery(cid, 'user_admin_01');
    dbService.addDeliveryItem(pkg.id, {
      kind: 'ADVICE',
      title: 'P1 E2E briefing advice',
      rationale: 'Deterministic P1 acknowledgement proof.',
    });
    dbService.markDeliverySent(pkg.id);
    const sent = dbService.getDeliveryById(pkg.id);
    if (sent) {
      const existing = dbService.getSentDeliveriesByClient(cid);
      const latestSentAt = existing.reduce((max, row) => {
        if (!row.sentAt) return max;
        return row.sentAt > max ? row.sentAt : max;
      }, sent.sentAt ?? '');
      sent.sentAt = new Date(Date.parse(latestSentAt || sent.sentAt || Date.now()) + 60_000).toISOString();
    }
    return pkg.id;
  }, { cid: clientId });
}

test.describe('P1 §25 — React client portal acknowledge delivery', () => {
  test('CLIENT acknowledges latest SENT briefing under React shell', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsClientJuan(page);
    await seedSentBriefing(page, CLIENT_JUAN_ID);
    await sidebarTab(page, 'client-content').click();
    await expect(page.locator('[data-testid="react-portal-content"]')).toBeVisible({ timeout: 15_000 });
    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-briefing-card"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="react-portal-briefing-ack"]')).toBeVisible({ timeout: 15_000 });
    await page.fill('[data-testid="react-portal-briefing-note"]', 'Lo reviso esta semana');
    await page.click('[data-testid="react-portal-briefing-ack"]');
    await expect(page.locator('[data-testid="react-portal-briefing-success"]')).toHaveText(
      'Briefing marcado como visto'
    );
    await expect(page.locator('[data-testid="react-portal-briefing-ack"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-portal-briefing-read"]')).toBeVisible();

    const stored = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const latest = dbService.getSentDeliveriesByClient(cid)[0];
      return latest
        ? { status: latest.status, clientAckNote: latest.clientAckNote ?? null }
        : null;
    }, { cid: CLIENT_JUAN_ID });
    expect(stored).toEqual({ status: 'ACKNOWLEDGED', clientAckNote: 'Lo reviso esta semana' });
  });
});
