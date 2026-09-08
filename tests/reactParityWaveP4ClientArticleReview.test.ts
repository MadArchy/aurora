/**
 * SPEC-010 · T603 React Parity Wave P4 — #32 Client Article Review.
 *
 * Presentation parity only via frozen ReviewClientArticle command seam.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTrustedTenantScope } from '../src/ui/query/tenantScope';
import type { User } from '../src/types';

const reviewCalls: {
  requestedClientId: string | null | undefined;
  contentId: string;
  decision: string;
  title?: string;
  body?: string;
  reason?: string;
  taskId?: string;
}[] = [];

const openCalls: {
  requestedClientId: string | null | undefined;
  contentId: string;
  taskId?: string;
}[] = [];

const transitionCalls: {
  requestedClientId: string | null | undefined;
  taskId: string;
  intent: string;
}[] = [];

const notifyCalls: { clientId: string; title: string; body: string }[] = [];

let reviewImpl: ((intent: (typeof reviewCalls)[number]) => {
  content: { id: string; clientId: string; title: string };
  decision: string;
  feedbackEvent?: { diffSummary?: { added: number; removed: number } } | null;
}) | null = null;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/notifications', () => ({
  notifyManager: (clientId: string, input: { title: string; body: string }) => {
    notifyCalls.push({ clientId, title: input.title, body: input.body });
    return true;
  },
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  reviewClientArticle: (intent: (typeof reviewCalls)[number]) => {
    reviewCalls.push(intent);
    if (reviewImpl) return reviewImpl(intent);
    return {
      content: { id: intent.contentId, clientId: 'client_a', title: intent.title || 'Draft' },
      decision: intent.decision,
      feedbackEvent: intent.decision === 'save_revision' ? { diffSummary: { added: 1, removed: 0 } } : null,
    };
  },
  transitionClientTask: (intent: (typeof transitionCalls)[number] & { intent: string }) => {
    transitionCalls.push(intent);
    return { task: { id: intent.taskId }, intent: intent.intent, statusChanged: true };
  },
  acknowledgeDelivery: vi.fn(),
  saveContentDraft: vi.fn(),
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getContentById: vi.fn((id: string) =>
      id === 'cnt_1'
        ? {
            id: 'cnt_1',
            clientId: 'client_a',
            organizationId: 'org_a',
            title: 'Draft',
            body: 'Body text',
            status: 'CLIENT_REVIEW',
            targetPlatform: 'LinkedIn',
            type: 'ARTICLE',
            managerNotes: 'Tone note',
          }
        : undefined
    ),
    getAllTasks: vi.fn(() => [
      {
        id: 'task_article',
        type: 'REVIEW_ARTICLE',
        status: 'ASSIGNED',
        clientId: 'client_a',
        contentItemId: 'cnt_1',
      },
      {
        id: 'task_generic',
        type: 'SUBMIT_INFO',
        status: 'ASSIGNED',
        clientId: 'client_a',
      },
      {
        id: 'task_video',
        type: 'RECORD_VIDEO',
        status: 'ASSIGNED',
        clientId: 'client_a',
      },
    ]),
    getTasksForClient: vi.fn(() => []),
    getContentForClient: vi.fn(() => []),
    getFeedbackEventsForContent: vi.fn(() => []),
    transitionContentPipeline: vi.fn((contentId: string, next: string) => ({
      id: contentId,
      pipelineStatus: next,
      status: 'CLIENT_REVIEW',
      clientId: 'client_a',
      organizationId: 'org_a',
      title: 'Draft',
      body: 'Body text',
      targetPlatform: 'LinkedIn',
      type: 'ARTICLE',
    })),
  },
}));

vi.mock('../src/controllers/contentPipelineCommands', () => ({
  pipelineActor: () => ({ uid: 'client_user', role: 'CLIENT' }),
  advanceContentPipelineTarget: vi.fn(),
}));

vi.mock('../src/domain/articleReviewCore', async () => {
  const actual = await vi.importActual<typeof import('../src/domain/articleReviewCore')>(
    '../src/domain/articleReviewCore'
  );
  return {
    ...actual,
    resolveArticleSavePipelineSteps: () => ['client_in_progress'],
  };
});

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function clientUser(): User {
  return {
    uid: 'u_client',
    organizationId: 'org_a',
    role: 'CLIENT',
    clientId: 'client_a',
    displayName: 'Cliente',
    email: 'c@example.com',
  };
}

describe('P4 §1–§3 — surface ownership and freezes', () => {
  it('portal owns native article review once; no content LegacyHandoff', () => {
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/data-testid="react-portal-article-review"/);
    expect(portal).toMatch(/useReviewClientArticle/);
    expect(portal).toMatch(/useOpenClientArticleReview/);
    expect(portal).not.toMatch(/react-portal-content-handoff/);
    expect(portal).not.toMatch(/react-portal-task-handoff-article-/);
  });

  it('video handoff retained; attach_evidence and #31 not wired in portal', () => {
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/react-portal-task-handoff-video-/);
    expect(portal).not.toMatch(/attach_evidence/);
    expect(portal).not.toMatch(/saveContentDraft/);
    expect(portal).not.toMatch(/MediaRecorder/);
    expect(portal).not.toMatch(/persistRecording/);
  });

  it('React portal never imports dbService directly', () => {
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    expect(portal).not.toMatch(/\bdbService\b/);
    expect(hooks).not.toMatch(/\bdbService\b/);
  });

  it('Application ReviewClientArticle file remains frozen reference', () => {
    const app = code('src/application/executionDelivery/ReviewClientArticle.ts');
    expect(app).toMatch(/requireClientRole/);
    expect(app).toMatch(/save_revision/);
    expect(app).toMatch(/request_changes/);
  });
});

describe('P4 §4–§5 — command seam public input', () => {
  beforeEach(async () => {
    reviewCalls.length = 0;
    openCalls.length = 0;
    transitionCalls.length = 0;
    notifyCalls.length = 0;
    reviewImpl = null;
    vi.resetModules();
  });

  it('save_revision invokes ReviewClientArticle once with public input only', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.reviewClientArticle({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      decision: 'save_revision',
      title: 'Edited',
      body: 'New body',
      taskId: 'task_article',
    });
    expect(result.ok).toBe(true);
    expect(reviewCalls).toHaveLength(1);
    expect(reviewCalls[0]).toEqual({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      decision: 'save_revision',
      title: 'Edited',
      body: 'New body',
      taskId: 'task_article',
    });
    expect(JSON.stringify(reviewCalls[0])).not.toMatch(/organizationId|actorRole|trusted/);
    expect(notifyCalls[0]?.title).toBe('Cliente editó borrador');
  });

  it('approve invokes ReviewClientArticle once and notifies', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.reviewClientArticle({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      decision: 'approve',
      taskId: 'task_article',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toMatch(/aprobado/i);
    expect(reviewCalls).toHaveLength(1);
    expect(reviewCalls[0]?.decision).toBe('approve');
    expect(notifyCalls[0]?.title).toBe('Artículo aprobado por el cliente');
  });

  it('request_changes requires reason path and notifies', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.reviewClientArticle({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      decision: 'request_changes',
      reason: 'Necesita más ejemplos',
      taskId: 'task_article',
    });
    expect(result.ok).toBe(true);
    expect(reviewCalls).toHaveLength(1);
    expect(reviewCalls[0]?.reason).toBe('Necesita más ejemplos');
    expect(notifyCalls[0]?.title).toBe('Artículo rechazado por el cliente');
  });
});

describe('P4 §6 — #28 start coupling for REVIEW_ARTICLE open only', () => {
  beforeEach(async () => {
    transitionCalls.length = 0;
    vi.resetModules();
  });

  it('REVIEW_ARTICLE open invokes TransitionClientTask start once when applicable', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.openClientArticleReview({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      taskId: 'task_article',
    });
    expect(result.ok).toBe(true);
    expect(transitionCalls).toHaveLength(1);
    expect(transitionCalls[0]).toMatchObject({
      taskId: 'task_article',
      intent: 'start',
    });
  });

  it('open rejects non-REVIEW_ARTICLE task ids', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.openClientArticleReview({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      taskId: 'task_generic',
    });
    expect(result.ok).toBe(false);
    expect(transitionCalls).toHaveLength(0);
  });

  it('generic TransitionClientTask hook still excludes start', () => {
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(
      /intent: 'view' \| 'complete' \| 'request_changes'/
    );
    expect(hooks).not.toMatch(
      /useTransitionClientTask[\s\S]*intent: 'view' \| 'start'/
    );
  });
});

describe('P4 §7 — authority inputs and rollback retention', () => {
  it('seam review path does not accept claimed authority fields from React hook', () => {
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useReviewClientArticle/);
    expect(hooks).not.toMatch(/claimedOrganizationId/);
    expect(hooks).not.toMatch(/claimedClientId/);
    expect(hooks).not.toMatch(/claimedStatus/);
  });

  it('legacy article-review modal retained for global rollback', () => {
    const modals = code('src/components/Modals.ts');
    expect(modals).toMatch(/renderArticleReviewModal/);
    expect(modals).toMatch(/form-article-review/);
    const handlers = code('src/ui/legacy/handlers/contentHandlers.ts');
    expect(handlers).toMatch(/btn-open-article-review/);
    expect(handlers).toMatch(/decision: 'save_revision'/);
  });

  it('teleprompter / VIDEO_SUBMITTED presentation unchanged', () => {
    const tele = code('src/ui/legacy/teleprompterController.ts');
    expect(tele).toMatch(/VIDEO_SUBMITTED/);
    expect(tele).toMatch(/intent: 'start'/);
    expect(tele).toMatch(/persistRecording/);
  });
});

describe('P4 §8 — read projection fields', () => {
  it('compatibility content detail exposes article review fields', async () => {
    const { readContentDetail } = await import('../src/ui/data/compatibilityReads');
    const scope = buildTrustedTenantScope({
      organizationId: 'org_a',
      actorUserId: 'u_client',
      actorRole: 'CLIENT',
      clientId: 'client_a',
    });
    // db mock returns content; requireClient uses scope.clientId
    const detail = readContentDetail(scope, 'cnt_1');
    expect(detail.resolved).toBe(true);
    expect(detail.title).toBe('Draft');
    expect(detail.body).toBe('Body text');
    expect(detail.managerNotes).toBe('Tone note');
    expect(detail.legacyStatus).toBe('CLIENT_REVIEW');
  });

  it('client tasks expose contentItemId for REVIEW_ARTICLE open', () => {
    const reads = code('src/ui/data/compatibilityReads.ts');
    expect(reads).toMatch(/contentItemId: task\.contentItemId/);
  });
});
