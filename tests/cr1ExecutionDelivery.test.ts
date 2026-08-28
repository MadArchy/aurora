/**
 * CR-1 Workstream 5 — Execution Delivery Application tests.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
});

import {
  ExecutionDeliveryError,
  createReviewClientArticle,
  createSaveContentDraft,
  createTransitionClientTask,
  type ContentPublicationGatePort,
  type ContentRepository,
  type TaskRepository,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { ContentItem, Task } from '../src/types';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { TASK_TRANSITIONS } from '../src/domain/stateMachine';

function adminTrusted(
  overrides: Partial<TrustedExecutionDeliveryContext> = {}
): TrustedExecutionDeliveryContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    now: '2026-08-28T20:00:00.000Z',
    ...overrides,
  };
}

function clientTrusted(
  overrides: Partial<TrustedExecutionDeliveryContext> = {}
): TrustedExecutionDeliveryContext {
  return adminTrusted({ actorId: 'client_01', actorRole: 'CLIENT', ...overrides });
}

function memoryTasks(seed: Task[] = []) {
  const store = new Map(seed.map((t) => [t.id, { ...t }]));
  const repo: TaskRepository = {
    getById(id) {
      return store.get(id);
    },
    listByClient(clientId) {
      return [...store.values()].filter((t) => t.clientId === clientId);
    },
    saveStatus(input) {
      const t = store.get(input.taskId)!;
      const allowed = TASK_TRANSITIONS[t.status] || [];
      if (!allowed.includes(input.status)) {
        throw new Error(`TASK_INVALID_TRANSITION:${t.status}->${input.status}`);
      }
      const next = {
        ...t,
        status: input.status,
        evidenceUrl: input.evidenceUrl ?? t.evidenceUrl,
        clientNotes: input.clientNotes ?? t.clientNotes,
        completedAt: input.completedAt ?? t.completedAt,
      };
      store.set(input.taskId, next);
      return next;
    },
    saveEvidence(input) {
      const t = store.get(input.taskId)!;
      const next = {
        ...t,
        evidenceUrl: input.evidenceUrl,
        clientNotes: input.clientNotes ?? t.clientNotes,
      };
      store.set(input.taskId, next);
      return next;
    },
    saveNotes(input) {
      const t = store.get(input.taskId)!;
      const next = { ...t, clientNotes: input.clientNotes };
      store.set(input.taskId, next);
      return next;
    },
  };
  return { repo, store };
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    type: 'SUBMIT_INFO',
    title: 'Task',
    description: 'd',
    estimatedMinutes: 10,
    status: 'ASSIGNED',
    createdAt: '2026-08-28T19:00:00.000Z',
    ...overrides,
  };
}

function baseContent(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'cnt_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    thesisId: 'thesis_1',
    type: 'LINKEDIN_ARTICLE',
    title: 'Draft',
    body: 'Body text',
    targetPlatform: 'LinkedIn',
    status: 'CLIENT_REVIEW',
    pipelineStatus: 'sent_to_client',
    createdAt: '2026-08-28T19:00:00.000Z',
    updatedAt: '2026-08-28T19:00:00.000Z',
    strategicBriefId: 'brief_1',
    strategicBriefVersion: 1,
    ...overrides,
  };
}

function memoryContents(seed: ContentItem[] = []) {
  const store = new Map(seed.map((c) => [c.id, { ...c }]));
  const feedback: unknown[] = [];
  const repo: ContentRepository = {
    getById(id) {
      return store.get(id);
    },
    saveDraft(contentId, fields, updatedAt) {
      const c = store.get(contentId)!;
      const next = { ...c, ...fields, updatedAt };
      store.set(contentId, next);
      return next;
    },
    transitionPipeline(input) {
      const c = store.get(input.contentId)!;
      const next = {
        ...c,
        pipelineStatus: input.next,
        status:
          input.next === 'client_submitted'
            ? ('CLIENT_APPROVED' as const)
            : input.next === 'client_in_progress'
              ? ('CHANGES_REQUESTED' as const)
              : c.status,
        updatedAt: '2026-08-28T20:00:00.000Z',
      };
      store.set(input.contentId, next);
      return next;
    },
    saveClientRevision(input) {
      const c = store.get(input.contentId)!;
      if (c.body === input.body && c.title === input.title) return null;
      const event = {
        id: `fbk_${feedback.length + 1}`,
        organizationId: c.organizationId,
        clientId: c.clientId,
        contentId: input.contentId,
        taskId: input.taskId,
        kind: 'CLIENT_EDIT' as const,
        actorUid: input.actorUid,
        actorRole: 'CLIENT' as const,
        createdAt: '2026-08-28T20:00:00.000Z',
        diffSummary: { added: 1, removed: 0, unchanged: 1 },
      };
      feedback.push(event);
      store.set(input.contentId, { ...c, title: input.title, body: input.body });
      return event;
    },
    addFeedback(input) {
      const event = {
        id: `fbk_${feedback.length + 1}`,
        ...input,
        createdAt: '2026-08-28T20:00:00.000Z',
      };
      feedback.push(event);
      return event;
    },
  };
  const gate: ContentPublicationGatePort = {
    authorize: () => ({ allowed: true }),
  };
  return { repo, store, gate };
}

describe('CR-1 Execution Delivery — TransitionClientTask', () => {
  it('authorized view then complete', () => {
    const { repo, store } = memoryTasks([baseTask()]);
    const transition = createTransitionClientTask({ tasks: repo });
    transition({ trusted: clientTrusted(), taskId: 'task_1', intent: 'view' });
    expect(store.get('task_1')?.status).toBe('VIEWED');
    transition({ trusted: clientTrusted(), taskId: 'task_1', intent: 'start' });
    transition({ trusted: clientTrusted(), taskId: 'task_1', intent: 'complete' });
    expect(store.get('task_1')?.status).toBe('COMPLETED');
  });

  it('ATTACH evidence without status change', () => {
    const { repo, store } = memoryTasks([baseTask({ status: 'IN_PROGRESS' })]);
    const transition = createTransitionClientTask({ tasks: repo });
    transition({
      trusted: adminTrusted(),
      taskId: 'task_1',
      intent: 'attach_evidence',
      evidenceUrl: 'rec://x',
    });
    expect(store.get('task_1')?.status).toBe('IN_PROGRESS');
    expect(store.get('task_1')?.evidenceUrl).toBe('rec://x');
  });

  it('ATTACK: cross-client denied', () => {
    const { repo } = memoryTasks([baseTask()]);
    const transition = createTransitionClientTask({ tasks: repo });
    expect(() =>
      transition({
        trusted: clientTrusted({ clientId: 'other' }),
        taskId: 'task_1',
        intent: 'view',
      })
    ).toThrow(ExecutionDeliveryError);
  });

  it('ATTACK: status spoof denied', () => {
    const { repo } = memoryTasks([baseTask()]);
    const transition = createTransitionClientTask({ tasks: repo });
    expect(() =>
      transition({
        trusted: clientTrusted(),
        taskId: 'task_1',
        intent: 'view',
        claimedStatus: 'COMPLETED',
      })
    ).toThrow(/lifecycle|publication/i);
  });

  it('invalid transition denied by Domain', () => {
    const { repo } = memoryTasks([baseTask({ status: 'COMPLETED' })]);
    const transition = createTransitionClientTask({ tasks: repo });
    expect(() =>
      transition({ trusted: clientTrusted(), taskId: 'task_1', intent: 'complete' })
    ).not.toThrow(); // same status no-op
    expect(() =>
      transition({ trusted: clientTrusted(), taskId: 'task_1', intent: 'view' })
    ).toThrow(/INVALID_TRANSITION|TASK_INVALID/);
  });
});

describe('CR-1 Execution Delivery — SaveContentDraft', () => {
  it('saves draft fields preserving strategic refs', () => {
    const { repo, store, gate } = memoryContents([baseContent()]);
    const save = createSaveContentDraft({ contents: repo, publicationGate: gate });
    const result = save({
      trusted: adminTrusted(),
      contentId: 'cnt_1',
      fields: { title: 'Updated', body: 'New body' },
    });
    expect(result.content.title).toBe('Updated');
    expect(store.get('cnt_1')?.strategicBriefId).toBe('brief_1');
    expect(store.get('cnt_1')?.thesisId).toBe('thesis_1');
    expect(result.advanced).toBe(false);
  });

  it('ATTACK: claim-safety spoof denied', () => {
    const { repo, gate } = memoryContents([baseContent()]);
    const save = createSaveContentDraft({ contents: repo, publicationGate: gate });
    expect(() =>
      save({
        trusted: adminTrusted(),
        contentId: 'cnt_1',
        fields: { title: 'X' },
        claimedClaimSafetyVerdict: 'PASS',
      })
    ).toThrow(/claim-safety/i);
  });

  it('ATTACK: CLIENT cannot save content draft', () => {
    const { repo, gate } = memoryContents([baseContent()]);
    const save = createSaveContentDraft({ contents: repo, publicationGate: gate });
    expect(() =>
      save({
        trusted: clientTrusted(),
        contentId: 'cnt_1',
        fields: { title: 'X' },
      })
    ).toThrow(/ADMIN/);
  });
});

describe('CR-1 Execution Delivery — ReviewClientArticle', () => {
  it('save_revision then approve', () => {
    const { repo, gate } = memoryContents([baseContent()]);
    const { repo: tasks } = memoryTasks([
      baseTask({
        id: 'task_art',
        type: 'REVIEW_ARTICLE',
        contentItemId: 'cnt_1',
        status: 'IN_PROGRESS',
      }),
    ]);
    const review = createReviewClientArticle({ contents: repo, tasks, publicationGate: gate });
    const saved = review({
      trusted: clientTrusted(),
      contentId: 'cnt_1',
      decision: 'save_revision',
      title: 'Draft',
      body: 'Edited body',
      taskId: 'task_art',
    });
    expect(saved.feedbackEvent).toBeTruthy();
    const approved = review({
      trusted: clientTrusted(),
      contentId: 'cnt_1',
      decision: 'approve',
      taskId: 'task_art',
    });
    expect(approved.decision).toBe('approve');
  });

  it('request_changes requires reason', () => {
    const { repo, gate } = memoryContents([baseContent()]);
    const { repo: tasks } = memoryTasks();
    const review = createReviewClientArticle({ contents: repo, tasks, publicationGate: gate });
    expect(() =>
      review({
        trusted: clientTrusted(),
        contentId: 'cnt_1',
        decision: 'request_changes',
      })
    ).toThrow(/reason/);
  });

  it('ATTACK: ADMIN cannot client-review', () => {
    const { repo, gate } = memoryContents([baseContent()]);
    const { repo: tasks } = memoryTasks();
    const review = createReviewClientArticle({ contents: repo, tasks, publicationGate: gate });
    expect(() =>
      review({
        trusted: adminTrusted(),
        contentId: 'cnt_1',
        decision: 'approve',
      })
    ).toThrow(/CLIENT/);
  });

  it('ATTACK: publication spoof denied', () => {
    const { repo, gate } = memoryContents([baseContent()]);
    const { repo: tasks } = memoryTasks();
    const review = createReviewClientArticle({ contents: repo, tasks, publicationGate: gate });
    expect(() =>
      review({
        trusted: clientTrusted(),
        contentId: 'cnt_1',
        decision: 'approve',
        claimedPublicationState: 'published',
      })
    ).toThrow(/lifecycle|publication/i);
  });
});

describe('CR-1 Execution Delivery architecture', () => {
  it('compose exposes three commands', () => {
    const c = composeExecutionDelivery();
    expect(typeof c.transitionClientTask).toBe('function');
    expect(typeof c.saveContentDraft).toBe('function');
    expect(typeof c.reviewClientArticle).toBe('function');
  });

  it('main.ts adopts executionDeliveryConsumer for #28/#31/#32', () => {
    const source = readFileSync(resolve('src/main.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/transitionClientTask\s*\(/);
    expect(code).toMatch(/saveContentDraft\s*\(/);
    expect(code).toMatch(/reviewClientArticle\s*\(/);
  });

  it('command seam exposes executionDeliveryCommands', () => {
    const source = readFileSync(resolve('src/ui/commands/commandSeam.ts'), 'utf8');
    expect(source).toMatch(/executionDeliveryCommands/);
  });

  it('Application does not own SPEC-004/006/008/providers', () => {
    const files = [
      'src/application/executionDelivery/TransitionClientTask.ts',
      'src/application/executionDelivery/SaveContentDraft.ts',
      'src/application/executionDelivery/ReviewClientArticle.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/AuthorizePlannedAction|ProposeStrategicPlan/);
      expect(source).not.toMatch(/registerSignalOutcome|ApplyApprovedRecommendation/);
      expect(source).not.toMatch(/aiService|openai|fetch\(/);
      expect(source).not.toMatch(/VerifyClaim|LinkEvidenceToClaim/);
    }
  });

  it('does not reopen prior CR-1 workstreams', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/TransitionClientTask.ts'), 'utf8');
    expect(source).not.toMatch(/SaveThesis|RegisterSource|ApplyOnboardingStep|CreateClientWithInvite/);
  });
});
