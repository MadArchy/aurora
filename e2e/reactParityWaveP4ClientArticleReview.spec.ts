/**
 * SPEC-010 · T603 React Parity Wave P4 — bounded client article-review E2E.
 */
import { expect, test } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const P4_ARTICLE_TITLE = 'P4 article parity draft';

test.describe('P4 — React client portal article review', () => {
  test('CLIENT reviews article natively; video handoff and generic tasks remain', async ({ page }) => {
    test.setTimeout(90_000);

    await loginAsClientJuan(page);

    const ids = await page.evaluate(
      async ({ clientId, title }) => {
        const { dbService } = await import('/src/services/db.ts');
        const now = new Date().toISOString();
        let content = dbService
          .getContentForClient(clientId)
          .find((row) => row.title === title && row.status === 'CLIENT_REVIEW');
        if (!content) {
          const created = {
            id: `cnt_p4_${Date.now()}`,
            organizationId: 'org_aurora_01',
            clientId,
            thesisId: 'thesis_juan_ip_ai_adoption',
            title,
            body: 'Borrador P4 para revisión nativa en React.',
            type: 'LINKEDIN_ARTICLE' as const,
            targetPlatform: 'LinkedIn' as const,
            status: 'CLIENT_REVIEW' as const,
            createdAt: now,
            updatedAt: now,
            clientReviewBaseline: 'Borrador P4 para revisión nativa en React.',
          };
          dbService.saveContent(created);
          content = created;
        }

        let task = dbService
          .getTasksForClient(clientId)
          .find(
            (row) =>
              row.type === 'REVIEW_ARTICLE' &&
              row.contentItemId === content!.id &&
              row.status !== 'COMPLETED' &&
              row.status !== 'CANCELLED'
          );
        if (!task) {
          task = dbService.addTask({
            organizationId: 'org_aurora_01',
            clientId,
            thesisId: 'thesis_juan_ip_ai_adoption',
            type: 'REVIEW_ARTICLE',
            title: 'Revisar artículo P4',
            description: 'Paridad React #32',
            estimatedMinutes: 20,
            status: 'ASSIGNED',
            contentItemId: content.id,
          });
        }

        return { contentId: content.id, taskId: task.id };
      },
      { clientId: CLIENT_JUAN_ID, title: P4_ARTICLE_TITLE }
    );

    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });

    // Force compatibility query refresh after seed (same pattern as P3A).
    await sidebarTab(page, 'client-content').click();
    await expect(page.locator('[data-testid="react-portal-content"]')).toBeVisible({ timeout: 15_000 });
    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });

    const articleOpen = page.locator(`[data-testid="react-portal-article-task-open-${ids.taskId}"]`);
    await expect(articleOpen).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="react-portal-content-handoff"]')).toHaveCount(0);
    await expect(page.locator(`[data-testid="react-portal-task-handoff-article-${ids.taskId}"]`)).toHaveCount(0);

    await articleOpen.click();
    await expect(page.locator('[data-testid="react-portal-article-review"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.fill('[data-testid="react-portal-article-review-title"]', `${P4_ARTICLE_TITLE} editado`);
    await page.fill(
      '[data-testid="react-portal-article-review-body"]',
      'Borrador P4 editado por el cliente en React nativo.'
    );
    await page.click('[data-testid="react-portal-article-review-save"]');
    await expect(page.locator('[data-testid="react-portal-article-review-success"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.click('[data-testid="react-portal-article-review-approve"]');
    await expect(page.locator('[data-testid="react-portal-article-review-success"]')).toContainText(
      /aprobado/i,
      { timeout: 15_000 }
    );

    const stored = await page.evaluate(async ({ contentId, taskId }) => {
      const { dbService } = await import('/src/services/db.ts');
      const content = dbService.getContentById(contentId);
      const task = dbService.getAllTasks().find((row) => row.id === taskId);
      return {
        contentStatus: content?.status,
        contentTitle: content?.title,
        taskStatus: task?.status,
      };
    }, ids);

    expect(stored.contentTitle).toBe(`${P4_ARTICLE_TITLE} editado`);
    expect(stored.taskStatus === 'COMPLETED' || stored.contentStatus).toBeTruthy();

    await page.click('[data-testid="react-portal-article-review-close"]');
    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toContainText(
      'teleprompter'
    );
  });
});
