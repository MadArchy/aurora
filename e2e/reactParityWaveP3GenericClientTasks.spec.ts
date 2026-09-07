/**
 * SPEC-010 · T603 React Parity Wave P3A — bounded generic client task E2E.
 */
import { expect, test } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const P3A_TASK_TITLE = 'P3A generic parity task';

test.describe('P3A — React client portal generic task actions', () => {
  test('CLIENT completes generic task natively; video keeps legacy handoff', async ({ page }) => {
    test.setTimeout(60_000);

    await loginAsClientJuan(page);
    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });

    const taskId = await page.evaluate(
      async ({ clientId, title }) => {
        const { dbService } = await import('/src/services/db.ts');
        const existing = dbService
          .getTasksForClient(clientId)
          .find((task) => task.type === 'SUBMIT_INFO' && task.title === title && task.status !== 'COMPLETED');
        if (existing) return existing.id;
        const created = dbService.addTask({
          organizationId: 'org_aurora_01',
          clientId,
          thesisId: 'thesis_juan_ip_ai_adoption',
          type: 'SUBMIT_INFO',
          title,
          description: 'Tarea genérica para prueba de paridad React.',
          estimatedMinutes: 10,
          status: 'ASSIGNED',
        });
        return created.id;
      },
      { clientId: CLIENT_JUAN_ID, title: P3A_TASK_TITLE }
    );

    await sidebarTab(page, 'client-content').click();
    await expect(page.locator('[data-testid="react-portal-content"]')).toBeVisible({ timeout: 15_000 });
    await sidebarTab(page, 'client-home').click();

    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });

    const genericRow = page.locator(`[data-testid="react-portal-task-row-${taskId}"]`);
    await expect(genericRow).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-testid="react-portal-task-complete-${taskId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="react-portal-task-request-changes-${taskId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="react-portal-task-view-${taskId}"]`)).toBeVisible();

    await page.click(`[data-testid="react-portal-task-view-${taskId}"]`);
    await page.click(`[data-testid="react-portal-task-complete-${taskId}"]`);
    await expect(genericRow).toHaveCount(0, { timeout: 15_000 });

    const stored = await page.evaluate(async ({ id }) => {
      const { dbService } = await import('/src/services/db.ts');
      const task = dbService.getAllTasks().find((row) => row.id === id);
      return task ? { status: task.status } : null;
    }, { id: taskId });

    expect(stored).toEqual({ status: 'COMPLETED' });

    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toContainText(
      'teleprompter'
    );
  });
});
