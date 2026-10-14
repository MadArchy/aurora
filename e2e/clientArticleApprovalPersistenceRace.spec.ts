/**
 * SPEC-010 · PRET604-R5 — deterministic client approval persistence race (emulator only).
 *
 * Forces the interleaving behind the P4 failure: the approval commit is held on the
 * Firestore Write channel while the server pushes a realtime snapshot of the same
 * collections that still carries the pre-approval state. The local approval must survive
 * that stale snapshot, the UI must not announce it before the server holds it, and the
 * server must end with exactly one approval and one counter increment.
 */
import { expect, test, type Page } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';
import {
  clientDocPath,
  ownerGetField,
  ownerGetIntegerField,
  ownerListStringFields,
  ownerSeedContent,
  ownerSeedTask,
  waitForLocalDoc,
  waitForServerField,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

const WRITE_DELAY_MS = 4_000;
const ARTICLE_BODY = 'Borrador para la carrera de aprobación.';

/** Holds every Write-channel POST (commits) for `WRITE_DELAY_MS`, preserving their order. */
async function holdFirestoreWrites(page: Page) {
  const state = { active: false, held: 0 };
  let chain: Promise<void> = Promise.resolve();
  await page.route(/\/google\.firestore\.v1\.Firestore\/Write\/channel/, (route) => {
    if (!state.active || route.request().method() !== 'POST') return route.continue();
    state.held += 1;
    const turn = chain.then(() => new Promise<void>((resolve) => setTimeout(resolve, WRITE_DELAY_MS)));
    chain = turn;
    return turn.then(() => route.continue());
  });
  return state;
}

async function readLocalReview(page: Page, contentId: string, taskId: string) {
  return page.evaluate(
    async ({ cid, tid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const content = dbService.getContentById(cid);
      const task = dbService.getAllTasks().find((row) => row.id === tid);
      return { pipeline: content?.pipelineStatus, contentStatus: content?.status, taskStatus: task?.status };
    },
    { cid: contentId, tid: taskId }
  );
}

test.describe('PRET604-R5 — client approval survives a stale realtime snapshot', () => {
  test('approval held on the wire is protected, announced only once persisted, counted once', async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const contentId = await ownerSeedContent({
      id: `cnt_race_e2e_${stamp}`,
      clientId: CLIENT_JUAN_ID,
      title: 'Artículo carrera',
      body: ARTICLE_BODY,
      type: 'LINKEDIN_ARTICLE',
      targetPlatform: 'LinkedIn',
      status: 'CLIENT_REVIEW',
      pipelineStatus: 'sent_to_client',
      clientReviewBaseline: ARTICLE_BODY,
    });
    const taskId = await ownerSeedTask({
      id: `task_race_e2e_${stamp}`,
      clientId: CLIENT_JUAN_ID,
      type: 'REVIEW_ARTICLE',
      title: 'Revisar artículo carrera',
      contentItemId: contentId,
    });
    const rootPath = `clients/${CLIENT_JUAN_ID}`;
    const contentPath = clientDocPath(CLIENT_JUAN_ID, 'contents', contentId);
    const taskPath = clientDocPath(CLIENT_JUAN_ID, 'tasks', taskId);
    const writes = await holdFirestoreWrites(page);

    await loginAsClientJuan(page);
    await waitForLocalDoc(page, 'content', contentId);
    await waitForLocalDoc(page, 'task', taskId);
    await sidebarTab(page, 'client-home').click();
    await page.locator(`[data-testid="react-portal-article-task-open-${taskId}"]`).click();
    await expect(page.locator('[data-testid="react-portal-article-review"]')).toBeVisible({ timeout: 15_000 });
    await waitForServerField(taskPath, 'status', 'IN_PROGRESS');

    await page.fill('[data-testid="react-portal-article-review-body"]', 'Borrador editado antes de aprobar.');
    await page.click('[data-testid="react-portal-article-review-save"]');
    const success = page.locator('[data-testid="react-portal-article-review-success"]');
    await expect(success).toBeVisible({ timeout: 15_000 });
    await waitForServerField(contentPath, 'pipelineStatus', 'client_in_progress');
    const initialCount = (await ownerGetIntegerField(rootPath, 'completedTasksCount')) ?? 0;

    writes.active = true;
    await page.click('[data-testid="react-portal-article-review-approve"]');
    const markerId = await ownerSeedContent({
      id: `cnt_race_marker_${stamp}`,
      clientId: CLIENT_JUAN_ID,
      title: 'Marcador de snapshot',
      body: 'Fuerza un snapshot del servidor con el estado previo a la aprobación.',
      type: 'LINKEDIN_ARTICLE',
      targetPlatform: 'LinkedIn',
      status: 'DRAFT',
    });
    await waitForLocalDoc(page, 'content', markerId);

    expect(await ownerGetField(contentPath, 'pipelineStatus')).toBe('client_in_progress');
    expect(await readLocalReview(page, contentId, taskId)).toEqual({
      pipeline: 'client_submitted',
      contentStatus: 'CLIENT_APPROVED',
      taskStatus: 'COMPLETED',
    });
    await expect(success.filter({ hasText: /aprobado/i })).toHaveCount(0);

    await expect(success).toContainText(/aprobado/i, { timeout: 30_000 });
    expect(writes.held).toBeGreaterThan(0);
    expect(await ownerGetField(contentPath, 'pipelineStatus')).toBe('client_submitted');
    expect(await ownerGetField(contentPath, 'status')).toBe('CLIENT_APPROVED');
    expect(await ownerGetField(taskPath, 'status')).toBe('COMPLETED');
    writes.active = false;

    await expect
      .poll(() => ownerGetIntegerField(rootPath, 'completedTasksCount'), { timeout: 15_000 })
      .toBe(initialCount + 1);
    const approvals = (await ownerListStringFields(`${rootPath}/feedbackEvents`)).filter(
      (event) => event.kind === 'CLIENT_APPROVE' && event.contentId === contentId
    );
    expect(approvals).toHaveLength(1);

    const settleMarker = await ownerSeedContent({
      id: `cnt_race_settle_${stamp}`,
      clientId: CLIENT_JUAN_ID,
      title: 'Marcador final',
      body: 'Snapshot posterior a la confirmación.',
      type: 'LINKEDIN_ARTICLE',
      targetPlatform: 'LinkedIn',
      status: 'DRAFT',
    });
    await waitForLocalDoc(page, 'content', settleMarker);
    expect(await readLocalReview(page, contentId, taskId)).toEqual({
      pipeline: 'client_submitted',
      contentStatus: 'CLIENT_APPROVED',
      taskStatus: 'COMPLETED',
    });
    expect(await ownerGetIntegerField(rootPath, 'completedTasksCount')).toBe(initialCount + 1);
  });
});
