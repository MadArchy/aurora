/**
 * CR-1 Workstream 5 — Execution Delivery Application tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  classifyContentMutationAuthorization,
  contentHasAuthoritativeGenericProof,
  createAddAdviceActionToCuration,
  createAddSignalToCuration,
  createDecideCuration,
  createReviewClientArticle,
  createSaveContentDraft,
  createTransitionClientTask,
  type AdviceReadPort,
  type ContentPublicationGatePort,
  type ContentRepository,
  type ContentStrategicBriefGatePort,
  type CurationRepositoryPort,
  type SignalReadPort,
  type TaskRepository,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { AdviceAction, ContentItem, CurationEntry, PositioningAdvice, Signal, Task } from '../src/types';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { TASK_TRANSITIONS } from '../src/domain/stateMachine';
import {
  addAdviceActionToCuration,
  addSignalToCuration,
  decideCuration,
  resetExecutionDeliveryConsumerForTest,
} from '../src/services/executionDeliveryConsumer';
import * as executionDeliveryConsumer from '../src/services/executionDeliveryConsumer';
import { SignalIntakeError } from '../src/application/signalIntake';
import { authService } from '../src/services/auth';
import { auditService } from '../src/services/audit';
import { dbService } from '../src/services/db';
import { handleAdviceToCurationClick } from '../src/ui/legacy/handlers/advisorHandlers';
import { handleCurationFormSubmit } from '../src/ui/legacy/handlers/curationHandlers';
import { handleSendToCurationClick } from '../src/ui/legacy/handlers/radarHandlers';
import type { AdvisorHandlerHost } from '../src/ui/legacy/legacyAppHost';
import type { CurationHandlerHost } from '../src/ui/legacy/legacyAppHost';
import type { RadarHandlerHost } from '../src/ui/legacy/legacyAppHost';
import * as signalIntakeConsumer from '../src/services/signalIntakeConsumer';

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
  let persistCount = 0;
  const repo: ContentRepository = {
    getById(id) {
      return store.get(id);
    },
    saveDraft(contentId, fields, updatedAt) {
      const c = store.get(contentId)!;
      persistCount += 1;
      const next = {
        ...c,
        ...fields,
        // Preserve authoritative strategic refs (adapter parity)
        id: c.id,
        organizationId: c.organizationId,
        clientId: c.clientId,
        thesisId: c.thesisId,
        strategicBriefId: c.strategicBriefId,
        strategicBriefVersion: c.strategicBriefVersion,
        signalIds: c.signalIds,
        supportingEvidenceIds: c.supportingEvidenceIds,
        updatedAt,
      };
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
  const briefGate: ContentStrategicBriefGatePort = {
    authorize: (input) => ({
      authorized: true,
      briefId: input.briefId,
      version: 1,
    }),
  };
  return { repo, store, gate, briefGate, getPersistCount: () => persistCount };
}

function saveDraft(
  contents: ContentRepository,
  publicationGate: ContentPublicationGatePort,
  strategicBriefGate: ContentStrategicBriefGatePort
) {
  return createSaveContentDraft({ contents, publicationGate, strategicBriefGate });
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
  it('saves draft fields preserving strategic refs when Brief authorizes', () => {
    const { repo, store, gate, briefGate } = memoryContents([baseContent()]);
    const save = saveDraft(repo, gate, briefGate);
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
    const { repo, gate, briefGate } = memoryContents([baseContent()]);
    const save = saveDraft(repo, gate, briefGate);
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
    const { repo, gate, briefGate } = memoryContents([baseContent()]);
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({
        trusted: clientTrusted(),
        contentId: 'cnt_1',
        fields: { title: 'X' },
      })
    ).toThrow(/ADMIN/);
  });
});

describe('CR-1 WS5 remediation — SaveContentDraft Brief gate', () => {
  it('strategic content + APPROVED Brief → PASS', () => {
    const { repo, store, gate } = memoryContents([baseContent()]);
    const briefGate: ContentStrategicBriefGatePort = {
      authorize: () => ({ authorized: true, briefId: 'brief_1', version: 2 }),
    };
    const save = saveDraft(repo, gate, briefGate);
    save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'Ok' } });
    expect(store.get('cnt_1')?.title).toBe('Ok');
  });

  it('strategic content + missing Brief reference → DENY before persist', () => {
    const { repo, store, gate, briefGate, getPersistCount } = memoryContents([
      baseContent({
        strategicBriefId: undefined,
        strategicBriefVersion: undefined,
        signalIds: ['sig_1'],
      }),
    ]);
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'No' } })
    ).toThrow(/strategicBriefId|Brief/i);
    expect(getPersistCount()).toBe(0);
    expect(store.get('cnt_1')?.title).toBe('Draft');
  });

  it('strategic content + nonexistent Brief → DENY before persist', () => {
    const { repo, store, gate, getPersistCount } = memoryContents([baseContent()]);
    const briefGate: ContentStrategicBriefGatePort = {
      authorize: () => ({
        authorized: false,
        briefId: 'brief_1',
        denialCode: 'BRIEF_NOT_FOUND',
        denialReason: 'Brief not found: brief_1',
      }),
    };
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'No' } })
    ).toThrow(ExecutionDeliveryError);
    expect(getPersistCount()).toBe(0);
    expect(store.get('cnt_1')?.title).toBe('Draft');
  });

  it('strategic content + REJECTED Brief → DENY', () => {
    const { repo, gate, getPersistCount } = memoryContents([baseContent()]);
    const briefGate: ContentStrategicBriefGatePort = {
      authorize: () => ({
        authorized: false,
        briefId: 'brief_1',
        denialCode: 'BRIEF_NOT_ACTIONABLE',
        denialReason: 'Brief does not authorize CREATE_CONTENT (status=REJECTED).',
      }),
    };
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'No' } })
    ).toThrow(/REJECTED|does not authorize|STRATEGIC_BRIEF/i);
    expect(getPersistCount()).toBe(0);
  });

  it('strategic content + SUPERSEDED Brief → DENY', () => {
    const { repo, gate, getPersistCount } = memoryContents([baseContent()]);
    const briefGate: ContentStrategicBriefGatePort = {
      authorize: () => ({
        authorized: false,
        briefId: 'brief_1',
        denialCode: 'BRIEF_NOT_ACTIONABLE',
        denialReason: 'Brief does not authorize CREATE_CONTENT (status=SUPERSEDED).',
      }),
    };
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'No' } })
    ).toThrow(/SUPERSEDED|does not authorize|STRATEGIC_BRIEF/i);
    expect(getPersistCount()).toBe(0);
  });

  it('strategic content + foreign tenant Brief → DENY', () => {
    const { repo, gate, getPersistCount } = memoryContents([baseContent()]);
    const briefGate: ContentStrategicBriefGatePort = {
      authorize: () => ({
        authorized: false,
        briefId: 'brief_1',
        denialCode: 'BRIEF_NOT_FOUND',
        denialReason: 'Brief not found: brief_1',
      }),
    };
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'No' } })
    ).toThrow(/Brief|STRATEGIC_BRIEF/i);
    expect(getPersistCount()).toBe(0);
  });

  it('strategic content + wrong-client Brief → DENY', () => {
    const { repo, gate, getPersistCount } = memoryContents([baseContent()]);
    const briefGate: ContentStrategicBriefGatePort = {
      authorize: () => ({
        authorized: false,
        briefId: 'brief_1',
        denialCode: 'BRIEF_NOT_FOUND',
        denialReason: 'Brief not found for trusted client.',
      }),
    };
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'No' } })
    ).toThrow(/Brief|STRATEGIC_BRIEF/i);
    expect(getPersistCount()).toBe(0);
  });

  it('thesisId alone is LEGACY_AMBIGUOUS — mutation DENY (not auto-generic)', () => {
    const { repo, store, gate, briefGate, getPersistCount } = memoryContents([
      baseContent({
        strategicBriefId: undefined,
        strategicBriefVersion: undefined,
        signalIds: undefined,
        supportingEvidenceIds: undefined,
        thesisId: 'thesis_only',
      }),
    ]);
    expect(classifyContentMutationAuthorization(store.get('cnt_1')!)).toBe('LEGACY_AMBIGUOUS');
    let briefCalls = 0;
    const trackingGate: ContentStrategicBriefGatePort = {
      authorize: (input) => {
        briefCalls += 1;
        return briefGate.authorize(input);
      },
    };
    const save = saveDraft(repo, gate, trackingGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { title: 'No auto-generic' } })
    ).toThrow(/LEGACY_AMBIGUOUS|CONTENT_AUTHORIZATION_AMBIGUOUS/i);
    expect(briefCalls).toBe(0);
    expect(getPersistCount()).toBe(0);
    expect(store.get('cnt_1')?.title).toBe('Draft');
  });

  it('ATTACK: caller Brief spoof denied', () => {
    const { repo, gate, briefGate, getPersistCount } = memoryContents([baseContent()]);
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({
        trusted: adminTrusted(),
        contentId: 'cnt_1',
        fields: { title: 'X' },
        claimedStrategicBriefId: 'brief_attacker',
      })
    ).toThrow(/strategicBriefId|authority/i);
    expect(getPersistCount()).toBe(0);
  });

  it('caller cannot remove strategicBriefId via fields (preserved)', () => {
    const { repo, store, gate, briefGate } = memoryContents([baseContent()]);
    const save = saveDraft(repo, gate, briefGate);
    save({
      trusted: adminTrusted(),
      contentId: 'cnt_1',
      fields: { title: 'Keep brief', body: 'x' },
    });
    expect(store.get('cnt_1')?.strategicBriefId).toBe('brief_1');
  });
});

describe('CR-1 WS5 classification remediation R2 — fail-closed', () => {
  it('seed-shaped cnt_video_script_001 → LEGACY_AMBIGUOUS + DENY + zero persist', () => {
    const seedShape = baseContent({
      id: 'cnt_video_script_001',
      thesisId: 'thesis_juan_ip_ai_adoption',
      type: 'VIDEO_SCRIPT',
      title: 'Guion Teleprompter: People, Tools & Rules',
      strategicBriefId: undefined,
      strategicBriefVersion: undefined,
      signalIds: undefined,
      supportingEvidenceIds: undefined,
    });
    expect(classifyContentMutationAuthorization(seedShape)).toBe('LEGACY_AMBIGUOUS');
    const { repo, store, gate, briefGate, getPersistCount } = memoryContents([seedShape]);
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({
        trusted: adminTrusted(),
        contentId: 'cnt_video_script_001',
        fields: { title: 'Mutate seed' },
      })
    ).toThrow(ExecutionDeliveryError);
    expect(() =>
      save({
        trusted: adminTrusted(),
        contentId: 'cnt_video_script_001',
        fields: { title: 'Mutate seed' },
      })
    ).toThrow(/LEGACY_AMBIGUOUS|CONTENT_AUTHORIZATION_AMBIGUOUS/i);
    expect(getPersistCount()).toBe(0);
    expect(store.get('cnt_video_script_001')?.title).toMatch(/Guion Teleprompter/);
  });

  it('no strategic refs and no generic proof → LEGACY_AMBIGUOUS DENY', () => {
    const { repo, gate, briefGate, getPersistCount } = memoryContents([
      baseContent({
        strategicBriefId: undefined,
        signalIds: undefined,
        supportingEvidenceIds: undefined,
      }),
    ]);
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({ trusted: adminTrusted(), contentId: 'cnt_1', fields: { body: 'x' } })
    ).toThrow(/LEGACY_AMBIGUOUS|CONTENT_AUTHORIZATION_AMBIGUOUS/i);
    expect(getPersistCount()).toBe(0);
  });

  it('GENERIC_PROVEN is currently unrepresentable on ContentItem', () => {
    expect(
      contentHasAuthoritativeGenericProof(
        baseContent({
          strategicBriefId: undefined,
          signalIds: undefined,
          supportingEvidenceIds: undefined,
        })
      )
    ).toBe(false);
  });

  it('ATTACK: caller claims mutation class → DENY', () => {
    const { repo, gate, briefGate, getPersistCount } = memoryContents([baseContent()]);
    const save = saveDraft(repo, gate, briefGate);
    expect(() =>
      save({
        trusted: adminTrusted(),
        contentId: 'cnt_1',
        fields: { title: 'X' },
        claimedContentMutationClass: 'GENERIC_PROVEN',
      })
    ).toThrow(/classification|authority/i);
    expect(getPersistCount()).toBe(0);
  });

  it('legacy content remains readable (getById unchanged)', () => {
    const { repo } = memoryContents([
      baseContent({
        id: 'cnt_video_script_001',
        strategicBriefId: undefined,
        signalIds: undefined,
        supportingEvidenceIds: undefined,
      }),
    ]);
    const read = repo.getById('cnt_video_script_001');
    expect(read?.id).toBe('cnt_video_script_001');
    expect(read?.thesisId).toBeTruthy();
  });

  it('STRATEGIC_GOVERNED classification for Brief-bearing content', () => {
    expect(classifyContentMutationAuthorization(baseContent())).toBe('STRATEGIC_GOVERNED');
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

describe('CR-1 Wave B1 #21a — AddSignalToCuration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  function baseSignal(overrides: Partial<Signal> = {}): Signal {
    return {
      id: 'sig_b1',
      organizationId: 'org_ed',
      clientId: 'client_ed',
      title: 'Signal title',
      sourceType: 'MANUAL',
      sourceName: 'Source',
      sourceUrl: 'https://example.com',
      contentSnippet: 'snippet text',
      fingerprint: 'fp',
      detectedAt: '2026-08-28T19:00:00.000Z',
      status: 'NEW',
      aiStatus: 'NONE',
      managerDecision: 'PENDING',
      relevanceScore: 82,
      priorityBand: 'HIGH',
      recommendedAction: 'MONITOR',
      thesisId: 'thesis_1',
      ...overrides,
    };
  }

  function memoryB1Ports(seed: Signal[] = []) {
    const signalStore = new Map(seed.map((s) => [s.id, { ...s }]));
    const curationEntries: CurationEntry[] = [];
    let persistCount = 0;
    const signals: SignalReadPort = {
      getById(id) {
        return signalStore.get(id);
      },
    };
    const curation: CurationRepositoryPort = {
      isSignalInCuration(clientId, signalId) {
        return curationEntries.some((e) => e.clientId === clientId && e.signalId === signalId);
      },
      addToCuration(entry) {
        persistCount += 1;
        const created: CurationEntry = {
          destination: null,
          managerRationale: '',
          deliveryPackageId: null,
          ...entry,
          id: `cur_${curationEntries.length + 1}`,
          createdAt: '2026-08-28T20:00:00.000Z',
        };
        curationEntries.unshift(created);
        return created;
      },
      getById() {
        return undefined;
      },
      decideCuration() {
        return null;
      },
    };
    return { signals, curation, signalStore, curationEntries, getPersistCount: () => persistCount };
  }

  function setupAdminGate(clientId = 'client_ed', organizationId = 'org_ed') {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      uid: 'admin_01',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId,
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    } as ReturnType<typeof authService.getCurrentUser>);
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: clientId,
      organizationId,
    } as ReturnType<typeof dbService.getClientById>);
  }

  function radarHost(overrides: Partial<RadarHandlerHost> = {}): RadarHandlerHost {
    return {
      resolveClientId: () => 'client_ed',
      showToast: vi.fn(),
      refreshMain: vi.fn(),
      ...overrides,
    } as RadarHandlerHost;
  }

  it('valid trusted ADMIN normal add persists one CurationEntry from authoritative Signal', () => {
    const { signals, curation } = memoryB1Ports([baseSignal()]);
    const add = createAddSignalToCuration({ signals, curation });
    const result = add({ trusted: adminTrusted(), signalId: 'sig_b1' });
    expect(result.entry.signalId).toBe('sig_b1');
    expect(result.entry.title).toBe('Signal title');
    expect(result.entry.snippet).toBe('snippet text');
    expect(result.entry.score).toBe(82);
    expect(result.entry.createdBy).toBe('admin_01');
  });

  it('authoritative Signal reload — entry fields come from persisted Signal not caller snapshot', () => {
    const { signals, curation, signalStore } = memoryB1Ports([baseSignal()]);
    signalStore.set('sig_b1', baseSignal({ title: 'Authoritative title', relevanceScore: 91 }));
    const add = createAddSignalToCuration({ signals, curation });
    const result = add({ trusted: adminTrusted(), signalId: 'sig_b1' });
    expect(result.entry.title).toBe('Authoritative title');
    expect(result.entry.score).toBe(91);
  });

  it('caller snapshot authority = 0 — spoofed organizationId denied before persist', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([baseSignal()]);
    const add = createAddSignalToCuration({ signals, curation });
    expect(() =>
      add({
        trusted: adminTrusted(),
        signalId: 'sig_b1',
        claimedOrganizationId: 'org_spoof',
      })
    ).toThrow(ExecutionDeliveryError);
    expect(getPersistCount()).toBe(0);
  });

  it('GATE_FIRST: reload then dedup then persist', () => {
    const order: string[] = [];
    const signals: SignalReadPort = {
      getById() {
        order.push('reload');
        return baseSignal();
      },
    };
    const curation: CurationRepositoryPort = {
      isSignalInCuration() {
        order.push('dedup');
        return false;
      },
      addToCuration() {
        order.push('persist');
        return {
          id: 'cur_1',
          organizationId: 'org_ed',
          clientId: 'client_ed',
          signalId: 'sig_b1',
          title: 't',
          snippet: 's',
          destination: null,
          managerRationale: '',
          deliveryPackageId: null,
          createdAt: '2026-08-28T20:00:00.000Z',
          createdBy: 'admin_01',
        };
      },
      getById: () => undefined,
      decideCuration: () => null,
    };
    createAddSignalToCuration({ signals, curation })({
      trusted: adminTrusted(),
      signalId: 'sig_b1',
    });
    expect(order).toEqual(['reload', 'dedup', 'persist']);
  });

  it('cross-tenant denial when Signal organization differs from trusted session', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([
      baseSignal({ organizationId: 'org_other' }),
    ]);
    const add = createAddSignalToCuration({ signals, curation });
    expect(() => add({ trusted: adminTrusted(), signalId: 'sig_b1' })).toThrow(
      /trusted organization/i
    );
    expect(getPersistCount()).toBe(0);
  });

  it('wrong-client denial when Signal clientId differs from trusted entitlement', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([
      baseSignal({ clientId: 'client_other' }),
    ]);
    const add = createAddSignalToCuration({ signals, curation });
    expect(() => add({ trusted: adminTrusted(), signalId: 'sig_b1' })).toThrow(
      /trusted client entitlement/i
    );
    expect(getPersistCount()).toBe(0);
  });

  it('unauthorized role — CLIENT denied', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([baseSignal()]);
    const add = createAddSignalToCuration({ signals, curation });
    expect(() =>
      add({ trusted: clientTrusted(), signalId: 'sig_b1' })
    ).toThrow(/ADMIN role/i);
    expect(getPersistCount()).toBe(0);
  });

  it('missing session — empty actorId denied', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([baseSignal()]);
    const add = createAddSignalToCuration({ signals, curation });
    expect(() =>
      add({ trusted: adminTrusted({ actorId: '' }), signalId: 'sig_b1' })
    ).toThrow(/actorId/i);
    expect(getPersistCount()).toBe(0);
  });

  it('missing authoritative Signal — fail closed INVALID_INPUT', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([]);
    const add = createAddSignalToCuration({ signals, curation });
    try {
      add({ trusted: adminTrusted(), signalId: 'sig_missing' });
      expect.unreachable('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExecutionDeliveryError);
      expect((err as ExecutionDeliveryError).code).toBe('INVALID_INPUT');
      expect((err as ExecutionDeliveryError).message).toMatch(/Signal not found/i);
    }
    expect(getPersistCount()).toBe(0);
  });

  it('existing duplicate — CURATION_ALREADY_EXISTS, no persist', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([baseSignal()]);
    curation.addToCuration({
      organizationId: 'org_ed',
      clientId: 'client_ed',
      signalId: 'sig_b1',
      title: 'existing',
      snippet: 'x',
      createdBy: 'admin_01',
    });
    const add = createAddSignalToCuration({ signals, curation });
    try {
      add({ trusted: adminTrusted(), signalId: 'sig_b1' });
      expect.unreachable('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExecutionDeliveryError);
      expect((err as ExecutionDeliveryError).code).toBe('CURATION_ALREADY_EXISTS');
    }
    expect(getPersistCount()).toBe(1);
  });

  it('concurrent duplicate race — Application recheck blocks second write', () => {
    const { signals, curation, getPersistCount } = memoryB1Ports([baseSignal()]);
    curation.addToCuration({
      organizationId: 'org_ed',
      clientId: 'client_ed',
      signalId: 'sig_b1',
      title: 'race winner',
      snippet: 'x',
      createdBy: 'other',
    });
    const add = createAddSignalToCuration({ signals, curation });
    expect(() => add({ trusted: adminTrusted(), signalId: 'sig_b1' })).toThrow(
      ExecutionDeliveryError
    );
    expect(getPersistCount()).toBe(1);
  });

  it('persistence failure surfaces PERSISTENCE_ERROR', () => {
    const signals: SignalReadPort = { getById: () => baseSignal() };
    const curation: CurationRepositoryPort = {
      isSignalInCuration: () => false,
      addToCuration: () => {
        throw new Error('disk full');
      },
      getById: () => undefined,
      decideCuration: () => null,
    };
    const add = createAddSignalToCuration({ signals, curation });
    try {
      add({ trusted: adminTrusted(), signalId: 'sig_b1' });
      expect.unreachable('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExecutionDeliveryError);
      expect((err as ExecutionDeliveryError).code).toBe('PERSISTENCE_ERROR');
    }
  });

  it('no scoring inside use case', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/AddSignalToCuration.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/scoreSignal|scoreAndRouteSignal|strategicRouting/);
  });

  it('no routing inside use case', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/AddSignalToCuration.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/routingState|ResolveThesis|routeSignal/);
  });

  it('consumer addSignalToCuration performs no composite SIGNAL_TO_CURATION audit', () => {
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        signals: { getById: () => baseSignal() },
        curation: {
          isSignalInCuration: () => false,
          addToCuration: (entry) =>
            ({
              id: 'cur_audit',
              destination: null,
              managerRationale: '',
              deliveryPackageId: null,
              createdAt: '2026-08-28T20:00:00.000Z',
              ...entry,
            }) as CurationEntry,
          getById: () => undefined,
          decideCuration: () => null,
        },
      })
    );
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      uid: 'admin_01',
      role: 'ADMIN',
      organizationId: 'org_ed',
      clientId: null,
    } as ReturnType<typeof authService.getCurrentUser>);
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: 'client_ed',
      organizationId: 'org_ed',
    } as ReturnType<typeof dbService.getClientById>);

    addSignalToCuration({ requestedClientId: 'client_ed', signalId: 'sig_b1' });
    expect(auditSpy).not.toHaveBeenCalled();
    resetExecutionDeliveryConsumerForTest();
  });

  it('stale Signal TOCTOU: warning only, no write, no #21b, no audit, no refresh', () => {
    setupAdminGate();
    const host = radarHost();
    let getCalls = 0;
    vi.spyOn(dbService, 'getSignalById').mockImplementation(() => {
      getCalls += 1;
      if (getCalls === 1) {
        return baseSignal({ id: 'sig_stale_toctou' }) as ReturnType<typeof dbService.getSignalById>;
      }
      return undefined;
    });
    vi.spyOn(dbService, 'isSignalInCuration').mockReturnValue(false);
    const markSavedSpy = vi.spyOn(signalIntakeConsumer, 'markSignalSaved');
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    const addSpy = vi.spyOn(dbService, 'addToCuration');

    handleSendToCurationClick(host, 'sig_stale_toctou');

    expect(addSpy).not.toHaveBeenCalled();
    expect(markSavedSpy).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.showToast).toHaveBeenCalledWith(expect.stringMatching(/Signal not found/i), 'warning');
    expect(host.showToast).not.toHaveBeenCalledWith('Enviada a curación', 'success');
    expect(host.refreshMain).not.toHaveBeenCalled();
  });

  it('duplicate race at handler: info toast, no #21b, no audit, no refresh', () => {
    setupAdminGate();
    const host = radarHost();
    vi.spyOn(dbService, 'getSignalById').mockReturnValue(
      baseSignal({ id: 'sig_dup_race' }) as ReturnType<typeof dbService.getSignalById>
    );
    vi.spyOn(dbService, 'isSignalInCuration').mockReturnValue(false);
    vi.spyOn(executionDeliveryConsumer, 'addSignalToCuration').mockImplementation(() => {
      throw new ExecutionDeliveryError(
        'CURATION_ALREADY_EXISTS',
        'Esta señal ya está en la mesa de curación.'
      );
    });
    const markSavedSpy = vi.spyOn(signalIntakeConsumer, 'markSignalSaved');
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);

    handleSendToCurationClick(host, 'sig_dup_race');

    expect(host.showToast).toHaveBeenCalledWith(
      'Esta señal ya está en la mesa de curación.',
      'info'
    );
    expect(markSavedSpy).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.refreshMain).not.toHaveBeenCalled();
  });

  it('caller order: addSignalToCuration then markSignalSaved then audit then toast then refresh', () => {
    setupAdminGate();
    const order: string[] = [];
    const host = radarHost();
    vi.spyOn(dbService, 'getSignalById').mockReturnValue(
      baseSignal({ id: 'sig_order_b1' }) as ReturnType<typeof dbService.getSignalById>
    );
    vi.spyOn(dbService, 'isSignalInCuration').mockReturnValue(false);
    vi.spyOn(executionDeliveryConsumer, 'addSignalToCuration').mockImplementation(() => {
      order.push('addSignalToCuration');
      return { entry: { id: 'cur_order' } as CurationEntry };
    });
    vi.spyOn(signalIntakeConsumer, 'markSignalSaved').mockImplementation(() => {
      order.push('markSignalSaved');
      return { signal: baseSignal({ id: 'sig_order_b1' }) };
    });
    vi.spyOn(auditService, 'log').mockImplementation(() => {
      order.push('audit');
    });
    vi.spyOn(host, 'showToast').mockImplementation((msg, kind) => {
      if (kind === 'success') order.push('toast');
    });
    vi.spyOn(host, 'refreshMain').mockImplementation(() => {
      order.push('refresh');
    });

    handleSendToCurationClick(host, 'sig_order_b1');

    expect(order).toEqual([
      'addSignalToCuration',
      'markSignalSaved',
      'audit',
      'toast',
      'refresh',
    ]);
  });

  it('preload-missing Signal: silent return unchanged', () => {
    const host = radarHost();
    vi.spyOn(dbService, 'getSignalById').mockReturnValue(undefined);
    const addSpy = vi.spyOn(executionDeliveryConsumer, 'addSignalToCuration');
    handleSendToCurationClick(host, 'sig_preload_missing');
    expect(addSpy).not.toHaveBeenCalled();
    expect(host.showToast).not.toHaveBeenCalled();
    expect(host.refreshMain).not.toHaveBeenCalled();
  });
});

describe('CR-1 Wave B2 #21a — AddAdviceActionToCuration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  function baseAdviceAction(overrides: Partial<AdviceAction> = {}): AdviceAction {
    return {
      id: 'adv_b2_1',
      category: 'CONTENT',
      horizon: 'DAYS_30',
      title: 'Publish thought leadership',
      why: 'Visibility gap.',
      how: 'Draft LinkedIn article.',
      effortMinutes: 45,
      impact: 72,
      ...overrides,
    };
  }

  function basePositioningAdvice(overrides: Partial<PositioningAdvice> = {}): PositioningAdvice {
    return {
      id: 'advice_b2_1',
      organizationId: 'org_ed',
      clientId: 'client_ed',
      summary: 'Summary',
      diagnosis: {
        authorityScore: 70,
        consistencyScore: 65,
        evidenceScore: 60,
        visibilityScore: 55,
        strengths: [],
        gaps: [],
        risks: [],
      },
      actions: [baseAdviceAction()],
      usedLiveModel: false,
      generatedAt: '2026-08-28T20:00:00.000Z',
      generatedBy: 'admin_01',
      ...overrides,
    };
  }

  function memoryB2Ports(advice: PositioningAdvice | undefined = basePositioningAdvice()) {
    let store = advice ? { ...advice, actions: advice.actions.map((a) => ({ ...a })) } : undefined;
    let persistCount = 0;
    const advicePort: AdviceReadPort = {
      getLatestAdvice(clientId) {
        return store?.clientId === clientId ? store : undefined;
      },
      findAdviceAction(clientId, adviceActionId) {
        if (!store || store.clientId !== clientId) return undefined;
        const action = store.actions.find((a) => a.id === adviceActionId);
        return action ? { advice: store, action } : undefined;
      },
    };
    const curationEntries: CurationEntry[] = [];
    const curation: CurationRepositoryPort = {
      isSignalInCuration: () => false,
      addToCuration(entry) {
        persistCount += 1;
        const created: CurationEntry = {
          destination: null,
          managerRationale: '',
          deliveryPackageId: null,
          ...entry,
          id: `cur_${curationEntries.length + 1}`,
          createdAt: '2026-08-28T20:00:00.000Z',
        };
        curationEntries.unshift(created);
        return created;
      },
      getById() {
        return undefined;
      },
      decideCuration() {
        return null;
      },
    };
    return {
      advicePort,
      curation,
      curationEntries,
      getPersistCount: () => persistCount,
      setAdvice(next: PositioningAdvice | undefined) {
        store = next ? { ...next, actions: next.actions.map((a) => ({ ...a })) } : undefined;
      },
    };
  }

  function setupAdminGate(clientId = 'client_ed', organizationId = 'org_ed') {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      uid: 'admin_01',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId,
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    } as ReturnType<typeof authService.getCurrentUser>);
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: clientId,
      organizationId,
    } as ReturnType<typeof dbService.getClientById>);
  }

  function advisorHost(overrides: Partial<AdvisorHandlerHost> = {}): AdvisorHandlerHost {
    return {
      resolveClientId: () => 'client_ed',
      requireTenant: (_requested) =>
        ({
          ok: true,
          clientId: 'client_ed',
          organizationId: 'org_ed',
          actorId: 'admin_01',
          actorRole: 'ADMIN',
        }) as ReturnType<AdvisorHandlerHost['requireTenant']>,
      showToast: vi.fn(),
      setTab: vi.fn(),
      render: vi.fn(),
      ...overrides,
    } as AdvisorHandlerHost;
  }

  it('valid trusted ADMIN adds current AdviceAction with exact field mapping', () => {
    const { advicePort, curation } = memoryB2Ports();
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    const result = add({ trusted: adminTrusted(), adviceActionId: 'adv_b2_1' });
    expect(result.entry.title).toBe('Publish thought leadership');
    expect(result.entry.snippet).toBe('Visibility gap. Draft LinkedIn article.');
    expect(result.entry.score).toBe(72);
    expect(result.entry.aiAngle).toBe('Draft LinkedIn article.');
    expect(result.entry.organizationId).toBe('org_ed');
    expect(result.entry.clientId).toBe('client_ed');
    expect(result.entry.createdBy).toBe('admin_01');
    expect(result.entry.signalId).toBeUndefined();
    expect(result.entry.thesisId).toBeUndefined();
  });

  it('authoritative PositioningAdvice reload — fields from persisted action not caller', () => {
    const { advicePort, curation, setAdvice } = memoryB2Ports();
    setAdvice(
      basePositioningAdvice({
        actions: [baseAdviceAction({ title: 'Authoritative title', impact: 91, how: 'Angle' })],
      })
    );
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    const result = add({ trusted: adminTrusted(), adviceActionId: 'adv_b2_1' });
    expect(result.entry.title).toBe('Authoritative title');
    expect(result.entry.score).toBe(91);
    expect(result.entry.aiAngle).toBe('Angle');
  });

  it('requestedClientId is lookup/scope only — spoofed client denied before persist', () => {
    const { advicePort, curation, getPersistCount } = memoryB2Ports();
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    expect(() =>
      add({
        trusted: adminTrusted(),
        adviceActionId: 'adv_b2_1',
        claimedClientId: 'client_evil',
      })
    ).toThrow(ExecutionDeliveryError);
    expect(getPersistCount()).toBe(0);
  });

  it('GATE_FIRST: trusted context before advice reload before persist', () => {
    const order: string[] = [];
    const advicePort: AdviceReadPort = {
      getLatestAdvice() {
        order.push('reload');
        return basePositioningAdvice();
      },
      findAdviceAction() {
        order.push('lookup');
        return { advice: basePositioningAdvice(), action: baseAdviceAction() };
      },
    };
    const curation: CurationRepositoryPort = {
      isSignalInCuration: () => false,
      addToCuration() {
        order.push('persist');
        return {
          id: 'cur_1',
          organizationId: 'org_ed',
          clientId: 'client_ed',
          title: 't',
          snippet: 's',
          destination: null,
          managerRationale: '',
          deliveryPackageId: null,
          createdAt: '2026-08-28T20:00:00.000Z',
          createdBy: 'admin_01',
        };
      },
      getById: () => undefined,
      decideCuration: () => null,
    };
    createAddAdviceActionToCuration({ advice: advicePort, curation })({
      trusted: adminTrusted(),
      adviceActionId: 'adv_b2_1',
    });
    expect(order).toEqual(['lookup', 'persist']);
  });

  it('cross-tenant denial when advice organization differs from trusted session', () => {
    const { advicePort, curation, getPersistCount } = memoryB2Ports(
      basePositioningAdvice({ organizationId: 'org_other' })
    );
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    expect(() => add({ trusted: adminTrusted(), adviceActionId: 'adv_b2_1' })).toThrow(
      /trusted organization/i
    );
    expect(getPersistCount()).toBe(0);
  });

  it('wrong-client denial when advice clientId differs from trusted entitlement', () => {
    const advicePort: AdviceReadPort = {
      getLatestAdvice: () => basePositioningAdvice({ clientId: 'client_other' }),
      findAdviceAction: () => ({
        advice: basePositioningAdvice({ clientId: 'client_other' }),
        action: baseAdviceAction(),
      }),
    };
    const curation: CurationRepositoryPort = {
      isSignalInCuration: () => false,
      addToCuration: () => {
        throw new Error('should not persist');
      },
      getById: () => undefined,
      decideCuration: () => null,
    };
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    expect(() => add({ trusted: adminTrusted(), adviceActionId: 'adv_b2_1' })).toThrow(
      /trusted client entitlement/i
    );
  });

  it('unauthorized role — CLIENT denied', () => {
    const { advicePort, curation, getPersistCount } = memoryB2Ports();
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    expect(() =>
      add({ trusted: clientTrusted(), adviceActionId: 'adv_b2_1' })
    ).toThrow(/ADMIN role/i);
    expect(getPersistCount()).toBe(0);
  });

  it('missing session — empty actorId denied', () => {
    const { advicePort, curation, getPersistCount } = memoryB2Ports();
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    expect(() =>
      add({ trusted: adminTrusted({ actorId: '' }), adviceActionId: 'adv_b2_1' })
    ).toThrow(/actorId/i);
    expect(getPersistCount()).toBe(0);
  });

  it('missing PositioningAdvice or AdviceAction — ADVICE_ACTION_NOT_FOUND', () => {
    const { advicePort, curation, getPersistCount, setAdvice } = memoryB2Ports(undefined);
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    try {
      add({ trusted: adminTrusted(), adviceActionId: 'adv_missing' });
      expect.unreachable('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExecutionDeliveryError);
      expect((err as ExecutionDeliveryError).code).toBe('ADVICE_ACTION_NOT_FOUND');
    }
    setAdvice(basePositioningAdvice());
    try {
      add({ trusted: adminTrusted(), adviceActionId: 'adv_missing' });
      expect.unreachable('expected throw');
    } catch (err) {
      expect((err as ExecutionDeliveryError).code).toBe('ADVICE_ACTION_NOT_FOUND');
    }
    expect(getPersistCount()).toBe(0);
  });

  it('no Signal, #21b, AI, scoring, routing, or dedup inside use case', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/AddAdviceActionToCuration.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/scoreSignal|scoreAndRouteSignal|markSignalSaved|SignalReadPort/);
    expect(source).not.toMatch(/isSignalInCuration|CURATION_ALREADY_EXISTS/);
    expect(source).not.toMatch(/\bawait\b|async function|aiService|generatePositioningAdvice/);
  });

  it('repeat click creates two curation entries — no dedup', () => {
    const { advicePort, curation, getPersistCount } = memoryB2Ports();
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    add({ trusted: adminTrusted(), adviceActionId: 'adv_b2_1' });
    add({ trusted: adminTrusted(), adviceActionId: 'adv_b2_1' });
    expect(getPersistCount()).toBe(2);
  });

  it('persistence failure surfaces PERSISTENCE_ERROR', () => {
    const advicePort: AdviceReadPort = {
      getLatestAdvice: () => basePositioningAdvice(),
      findAdviceAction: () => ({ advice: basePositioningAdvice(), action: baseAdviceAction() }),
    };
    const curation: CurationRepositoryPort = {
      isSignalInCuration: () => false,
      addToCuration: () => {
        throw new Error('disk full');
      },
      getById: () => undefined,
      decideCuration: () => null,
    };
    const add = createAddAdviceActionToCuration({ advice: advicePort, curation });
    try {
      add({ trusted: adminTrusted(), adviceActionId: 'adv_b2_1' });
      expect.unreachable('expected throw');
    } catch (err) {
      expect((err as ExecutionDeliveryError).code).toBe('PERSISTENCE_ERROR');
    }
  });

  it('consumer performs no composite ADVICE_TO_CURATION audit', () => {
    setupAdminGate();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        advice: {
          getLatestAdvice: () => basePositioningAdvice(),
          findAdviceAction: () => ({
            advice: basePositioningAdvice(),
            action: baseAdviceAction(),
          }),
        },
        curation: {
          isSignalInCuration: () => false,
          addToCuration: (entry) =>
            ({
              id: 'cur_b2',
              destination: null,
              managerRationale: '',
              deliveryPackageId: null,
              createdAt: '2026-08-28T20:00:00.000Z',
              ...entry,
            }) as CurationEntry,
          getById: () => undefined,
          decideCuration: () => null,
        },
      })
    );
    addAdviceActionToCuration({ requestedClientId: 'client_ed', adviceActionId: 'adv_b2_1' });
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('handler missing action: silent return, no audit/toast/navigation', () => {
    setupAdminGate();
    const host = advisorHost();
    vi.spyOn(executionDeliveryConsumer, 'addAdviceActionToCuration').mockImplementation(() => {
      throw new ExecutionDeliveryError('ADVICE_ACTION_NOT_FOUND', 'Advice action not found: adv_missing');
    });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleAdviceToCurationClick(host, 'client_ed', 'adv_missing');
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.showToast).not.toHaveBeenCalled();
    expect(host.setTab).not.toHaveBeenCalled();
  });

  it('handler security failure: warning, no success audit/toast/navigation', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: 'client_ed',
      organizationId: 'org_ed',
    } as ReturnType<typeof dbService.getClientById>);
    const host = advisorHost();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleAdviceToCurationClick(host, 'client_ed', 'adv_b2_1');
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.showToast).toHaveBeenCalledWith('Sesión no disponible — acción cancelada.', 'warning');
    expect(host.setTab).not.toHaveBeenCalled();
  });

  it('handler normal order: addAdviceActionToCuration then audit then toast then setTab', () => {
    setupAdminGate();
    const order: string[] = [];
    const host = advisorHost({
      showToast: vi.fn((msg, kind) => {
        if (kind === 'success') order.push('toast');
      }),
      setTab: vi.fn(() => order.push('tab')),
    });
    vi.spyOn(executionDeliveryConsumer, 'addAdviceActionToCuration').mockImplementation(() => {
      order.push('addAdviceActionToCuration');
      return { entry: { id: 'cur_b2', clientId: 'client_ed' } as CurationEntry, adviceActionId: 'adv_b2_1' };
    });
    vi.spyOn(auditService, 'log').mockImplementation(() => {
      order.push('audit');
    });
    handleAdviceToCurationClick(host, 'client_ed', 'adv_b2_1');
    expect(order).toEqual(['addAdviceActionToCuration', 'audit', 'toast', 'tab']);
  });

  it('handler repeat: two writes, two audits, two toasts, two tabs', () => {
    setupAdminGate();
    const host = advisorHost();
    const addSpy = vi.spyOn(executionDeliveryConsumer, 'addAdviceActionToCuration').mockImplementation(() => ({
      entry: { id: 'cur_b2', clientId: 'client_ed' } as CurationEntry,
      adviceActionId: 'adv_b2_1',
    }));
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleAdviceToCurationClick(host, 'client_ed', 'adv_b2_1');
    handleAdviceToCurationClick(host, 'client_ed', 'adv_b2_1');
    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(auditSpy).toHaveBeenCalledTimes(2);
    expect(host.showToast).toHaveBeenCalledTimes(2);
    expect(host.setTab).toHaveBeenCalledTimes(2);
  });

  it('no async yield between authoritative AdviceAction lookup and persistence', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/AddAdviceActionToCuration.ts'),
      'utf8'
    );
    const fnBody = source.match(
      /return function addAdviceActionToCuration[\s\S]*?^ {2}\};/m
    );
    expect(fnBody).toBeTruthy();
    expect(fnBody![0]).not.toMatch(/\bawait\b|async function/);
    const lookupIdx = fnBody![0].indexOf('findAdviceAction');
    const persistIdx = fnBody![0].indexOf('addToCuration');
    expect(lookupIdx).toBeGreaterThan(-1);
    expect(persistIdx).toBeGreaterThan(lookupIdx);
    expect(fnBody![0].slice(lookupIdx, persistIdx)).not.toMatch(/\bawait\b|setTimeout|Promise\./);
  });

  it('B1 AddSignalToCuration source unchanged', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/AddSignalToCuration.ts'),
      'utf8'
    );
    expect(source).toMatch(/CURATION_ALREADY_EXISTS/);
    expect(source).toMatch(/SignalReadPort/);
    expect(source).not.toMatch(/AdviceReadPort|ADVICE_ACTION_NOT_FOUND/);
  });
});

describe('CR-1 Wave B3 #14 — DecideCuration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  function baseCurationEntry(overrides: Partial<CurationEntry> = {}): CurationEntry {
    return {
      id: 'cur_b3_1',
      organizationId: 'org_ed',
      clientId: 'client_ed',
      signalId: 'sig_b3_1',
      title: 'Curation item',
      snippet: 'Snippet text',
      destination: null,
      managerRationale: '',
      deliveryPackageId: null,
      createdAt: '2026-08-28T20:00:00.000Z',
      createdBy: 'admin_01',
      ...overrides,
    };
  }

  function memoryB3Ports(entry: CurationEntry | undefined = baseCurationEntry()) {
    const store = entry ? [{ ...entry }] : [];
    let decideCount = 0;
    const curation: CurationRepositoryPort = {
      isSignalInCuration: () => false,
      addToCuration: (input) => {
        const created = {
          destination: null,
          managerRationale: '',
          deliveryPackageId: null,
          ...input,
          id: `cur_${store.length + 1}`,
          createdAt: '2026-08-28T20:00:00.000Z',
        } as CurationEntry;
        store.unshift(created);
        return created;
      },
      getById(id) {
        return store.find((c) => c.id === id);
      },
      decideCuration(input) {
        decideCount += 1;
        const item = store.find((c) => c.id === input.id);
        if (!item) return null;
        item.destination = input.destination;
        item.managerRationale = input.managerRationale;
        item.decidedBy = input.decidedBy;
        item.decidedAt = input.decidedAt;
        return { ...item };
      },
    };
    return { curation, store, getDecideCount: () => decideCount };
  }

  function setupAdminGate(clientId = 'client_ed', organizationId = 'org_ed') {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      uid: 'admin_01',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId,
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    } as ReturnType<typeof authService.getCurrentUser>);
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: clientId,
      organizationId,
    } as ReturnType<typeof dbService.getClientById>);
  }

  function curationHost(overrides: Partial<CurationHandlerHost> = {}): CurationHandlerHost {
    return {
      resolveClientId: () => 'client_ed',
      showToast: vi.fn(),
      render: vi.fn(),
      ...overrides,
    } as CurationHandlerHost;
  }

  it('valid trusted ADMIN decides with exact four-field mutation and trusted decidedBy', () => {
    const { curation } = memoryB3Ports();
    const decide = createDecideCuration({ curation });
    const result = decide({
      trusted: adminTrusted(),
      curationEntryId: 'cur_b3_1',
      destination: 'TASK_VIDEO',
      rationale: 'Valid rationale text',
    });
    expect(result.entry.destination).toBe('TASK_VIDEO');
    expect(result.entry.managerRationale).toBe('Valid rationale text');
    expect(result.entry.decidedBy).toBe('admin_01');
    expect(result.entry.decidedAt).toBe('2026-08-28T20:00:00.000Z');
  });

  it('authoritative reload — entry fields from persisted CurationEntry not caller snapshot', () => {
    const { curation } = memoryB3Ports(
      baseCurationEntry({ organizationId: 'org_ed', clientId: 'client_ed' })
    );
    const decide = createDecideCuration({ curation });
    const result = decide({
      trusted: adminTrusted(),
      curationEntryId: 'cur_b3_1',
      destination: 'EVIDENCE',
      rationale: 'Persisted authoritative entry',
    });
    expect(result.entry.organizationId).toBe('org_ed');
    expect(result.entry.clientId).toBe('client_ed');
  });

  it('cross-tenant denial when entry organization differs from trusted session', () => {
    const { curation, getDecideCount } = memoryB3Ports(
      baseCurationEntry({ organizationId: 'org_other' })
    );
    const decide = createDecideCuration({ curation });
    expect(() =>
      decide({
        trusted: adminTrusted(),
        curationEntryId: 'cur_b3_1',
        destination: 'TASK_VIDEO',
        rationale: 'Valid rationale text',
      })
    ).toThrow(/trusted organization/i);
    expect(getDecideCount()).toBe(0);
  });

  it('missing CurationEntry — CURATION_NOT_FOUND', () => {
    const { curation, getDecideCount } = memoryB3Ports(undefined);
    const decide = createDecideCuration({ curation });
    try {
      decide({
        trusted: adminTrusted(),
        curationEntryId: 'cur_missing',
        destination: 'TASK_VIDEO',
        rationale: 'Valid rationale text',
      });
      expect.unreachable('expected throw');
    } catch (err) {
      expect((err as ExecutionDeliveryError).code).toBe('CURATION_NOT_FOUND');
    }
    expect(getDecideCount()).toBe(0);
  });

  it('repeat decision overwrites mutable decision fields', () => {
    const { curation } = memoryB3Ports();
    const decide = createDecideCuration({ curation });
    decide({
      trusted: adminTrusted(),
      curationEntryId: 'cur_b3_1',
      destination: 'TASK_VIDEO',
      rationale: 'First rationale text',
    });
    const second = decide({
      trusted: adminTrusted({ actorId: 'admin_02' }),
      curationEntryId: 'cur_b3_1',
      destination: 'DISCARD',
      rationale: 'Second rationale text',
    });
    expect(second.entry.destination).toBe('DISCARD');
    expect(second.entry.managerRationale).toBe('Second rationale text');
    expect(second.entry.decidedBy).toBe('admin_02');
  });

  it('use case does not invoke Signal, #20, AI, or downstream materialization', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/DecideCuration.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/discardSignal|DiscardSignal|SignalReadPort|decideSignal/);
    expect(source).not.toMatch(/queueCurationInBriefing|ensureDraftDelivery|aiService/);
  });

  it('consumer performs no composite CURATION_DECIDED audit', () => {
    setupAdminGate();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        curation: memoryB3Ports().curation,
      })
    );
    decideCuration({
      requestedClientId: 'client_ed',
      curationEntryId: 'cur_b3_1',
      destination: 'TASK_VIDEO',
      rationale: 'Valid rationale text',
    });
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('handler missing curation: legacy-compatible audit, success toast, render', () => {
    setupAdminGate();
    const host = curationHost();
    vi.spyOn(executionDeliveryConsumer, 'decideCuration').mockImplementation(() => {
      throw new ExecutionDeliveryError('CURATION_NOT_FOUND', 'Curation entry not found: cur_missing');
    });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleCurationFormSubmit(host, 'cur_missing', 'TASK_VIDEO', 'Valid rationale text');
    expect(auditSpy).toHaveBeenCalledWith(
      authService.getCurrentUser(),
      'CURATION_DECIDED',
      'CurationEntry',
      'cur_missing',
      expect.objectContaining({ destination: 'TASK_VIDEO' })
    );
    expect(host.showToast).toHaveBeenCalledWith(
      'Destino confirmado. Añádelo al briefing cuando quieras.',
      'success'
    );
    expect(host.render).toHaveBeenCalled();
  });

  it('handler normal DISCARD order: DecideCuration → discardSignalForCurationComposite → audit → toast → render', () => {
    setupAdminGate();
    const order: string[] = [];
    const host = curationHost({
      showToast: vi.fn((_msg, kind) => {
        if (kind === 'success') order.push('toast');
      }),
      render: vi.fn(() => order.push('render')),
    });
    vi.spyOn(executionDeliveryConsumer, 'decideCuration').mockImplementation(() => {
      order.push('decideCuration');
      return {
        entry: baseCurationEntry({ signalId: 'sig_b3_1' }),
      };
    });
    vi.spyOn(signalIntakeConsumer, 'discardSignalForCurationComposite').mockImplementation(() => {
      order.push('discardSignalForCurationComposite');
      return { signal: { id: 'sig_b3_1' } as import('../src/types').Signal };
    });
    vi.spyOn(auditService, 'log').mockImplementation(() => {
      order.push('audit');
    });
    handleCurationFormSubmit(host, 'cur_b3_1', 'DISCARD', 'Valid rationale text');
    expect(order).toEqual([
      'decideCuration',
      'discardSignalForCurationComposite',
      'audit',
      'toast',
      'render',
    ]);
  });

  it('handler DISCARD SIGNAL_NOT_FOUND compat: success toast, no SIGNAL_DISCARDED audit', () => {
    setupAdminGate();
    const host = curationHost();
    vi.spyOn(executionDeliveryConsumer, 'decideCuration').mockReturnValue({
      entry: baseCurationEntry({ signalId: 'sig_stale' }),
    });
    vi.spyOn(signalIntakeConsumer, 'discardSignalForCurationComposite').mockImplementation(() => {
      throw new SignalIntakeError('SIGNAL_NOT_FOUND', 'Signal not found: sig_stale');
    });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleCurationFormSubmit(host, 'cur_b3_1', 'DISCARD', 'Valid rationale text');
    expect(auditSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledWith(
      authService.getCurrentUser(),
      'CURATION_DECIDED',
      'CurationEntry',
      'cur_b3_1',
      expect.any(Object)
    );
    expect(auditSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      'SIGNAL_DISCARDED',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(host.showToast).toHaveBeenCalledWith('Ítem descartado con justificación', 'success');
  });

  it('handler DISCARD non-not-found failure: partial warning, CURATION_DECIDED only', () => {
    setupAdminGate();
    const host = curationHost();
    vi.spyOn(executionDeliveryConsumer, 'decideCuration').mockReturnValue({
      entry: baseCurationEntry({ signalId: 'sig_b3_1' }),
    });
    vi.spyOn(signalIntakeConsumer, 'discardSignalForCurationComposite').mockImplementation(() => {
      throw new SignalIntakeError('ACTOR_NOT_AUTHORIZED', 'Denied');
    });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleCurationFormSubmit(host, 'cur_b3_1', 'DISCARD', 'Valid rationale text');
    expect(auditSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledWith(
      authService.getCurrentUser(),
      'CURATION_DECIDED',
      'CurationEntry',
      'cur_b3_1',
      expect.any(Object)
    );
    expect(host.showToast).toHaveBeenCalledWith(
      'La decisión de curación se guardó, pero no se pudo descartar la señal vinculada.',
      'warning'
    );
    expect(host.showToast).not.toHaveBeenCalledWith(expect.any(String), 'success');
    expect(host.render).toHaveBeenCalled();
  });

  it('handler DISCARD without signalId skips #20', () => {
    setupAdminGate();
    const host = curationHost();
    const discardSpy = vi.spyOn(signalIntakeConsumer, 'discardSignalForCurationComposite');
    vi.spyOn(executionDeliveryConsumer, 'decideCuration').mockReturnValue({
      entry: baseCurationEntry({ signalId: undefined }),
    });
    handleCurationFormSubmit(host, 'cur_b3_1', 'DISCARD', 'Valid rationale text');
    expect(discardSpy).not.toHaveBeenCalled();
    expect(host.showToast).toHaveBeenCalledWith('Ítem descartado con justificación', 'success');
  });

  it('handler security failure: warning, no success audit', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: 'client_ed',
      organizationId: 'org_ed',
    } as ReturnType<typeof dbService.getClientById>);
    const host = curationHost();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleCurationFormSubmit(host, 'cur_b3_1', 'TASK_VIDEO', 'Valid rationale text');
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.showToast).toHaveBeenCalledWith('Sesión no disponible — acción cancelada.', 'warning');
    expect(host.render).not.toHaveBeenCalled();
  });

  it('discardSignalForCurationComposite performs no SIGNAL_DISCARDED audit', () => {
    setupAdminGate();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    vi.spyOn(signalIntakeConsumer, 'discardSignalForCurationComposite').mockImplementation(() => ({
      signal: { id: 'sig_b3_1' } as import('../src/types').Signal,
    }));
    handleCurationFormSubmit(
      curationHost(),
      'cur_b3_1',
      'DISCARD',
      'Valid rationale text'
    );
    expect(auditSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      'SIGNAL_DISCARDED',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('B1/B2 use cases unchanged', () => {
    expect(readFileSync(resolve('src/application/executionDelivery/AddSignalToCuration.ts'), 'utf8')).toMatch(
      /CURATION_ALREADY_EXISTS/
    );
    expect(readFileSync(resolve('src/application/executionDelivery/AddAdviceActionToCuration.ts'), 'utf8')).toMatch(
      /ADVICE_ACTION_NOT_FOUND/
    );
  });
});

describe('CR-1 Execution Delivery architecture', () => {
  it('compose exposes seven commands including decideCuration', () => {
    const c = composeExecutionDelivery();
    expect(typeof c.transitionClientTask).toBe('function');
    expect(typeof c.saveContentDraft).toBe('function');
    expect(typeof c.reviewClientArticle).toBe('function');
    expect(typeof c.sendDeliveryPackage).toBe('function');
    expect(typeof c.addSignalToCuration).toBe('function');
    expect(typeof c.addAdviceActionToCuration).toBe('function');
    expect(typeof c.decideCuration).toBe('function');
  });

  it('main.ts adopts executionDeliveryConsumer for #18/#28/#31/#32', () => {
    const source = readLegacyControllerSurface();
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/sendDeliveryPackage\s*\(/);
    expect(code).toMatch(/transitionClientTask\s*\(/);
    expect(code).toMatch(/saveContentDraft\s*\(/);
    expect(code).toMatch(/reviewClientArticle\s*\(/);
  });

  it('teleprompter completes via TransitionClientTask — no direct updateTaskStatus', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/ui/legacy/teleprompterController.ts'), 'utf8');
    const submitIdx = source.indexOf('async submitClientVideo');
    expect(submitIdx).toBeGreaterThan(-1);
    const nextMethod = source.indexOf('\n  private ', submitIdx + 10);
    const block = source.slice(submitIdx, nextMethod === -1 ? undefined : nextMethod);
    expect(block).toMatch(/transitionClientTask\s*\(/);
    expect(block).toMatch(/intent:\s*'complete'/);
    expect(block).not.toMatch(/dbService\.updateTaskStatus/);
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
      expect(source).not.toMatch(/from ['"].*strategicBriefConsumer/);
      expect(source).not.toMatch(/from ['"][^'"]*\/main(\.ts)?['"]/);
      expect(source).not.toMatch(/from ['"][^'"]*\/ui\//);
    }
  });

  it('SaveContentDraft fail-closes ambiguous legacy — thesis is not substitute', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/SaveContentDraft.ts'),
      'utf8'
    );
    expect(source).toMatch(/strategicBriefGate\.authorize/);
    expect(source).toMatch(/classifyContentMutationAuthorization/);
    expect(source).toMatch(/LEGACY_AMBIGUOUS/);
    expect(source).toMatch(/CONTENT_AUTHORIZATION_AMBIGUOUS/);
    const classSource = readFileSync(
      resolve('src/application/executionDelivery/contentMutationAuthorization.ts'),
      'utf8'
    );
    expect(classSource).toMatch(/contentHasAuthoritativeGenericProof/);
    expect(classSource).toMatch(/return false/);
  });

  it('does not reopen prior CR-1 workstreams', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/TransitionClientTask.ts'), 'utf8');
    expect(source).not.toMatch(/SaveThesis|RegisterSource|ApplyOnboardingStep|CreateClientWithInvite/);
  });

  it('radar #21a delegates addSignalToCuration — no direct dbService.addToCuration', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/radarHandlers.ts'), 'utf8');
    const fnBlock = source.match(
      /export function handleSendToCurationClick[\s\S]*?^}/m
    );
    expect(fnBlock).toBeTruthy();
    expect(fnBlock![0]).toMatch(/addSignalToCuration\s*\(/);
    expect(fnBlock![0]).not.toMatch(/dbService\.addToCuration/);
  });

  it('advisor #21a delegates handleAdviceToCurationClick — no direct dbService.addToCuration', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/advisorHandlers.ts'), 'utf8');
    const curationBlock = source.match(
      /export function handleAdviceToCurationClick[\s\S]*?^}/m
    );
    expect(curationBlock).toBeTruthy();
    expect(curationBlock![0]).toMatch(/addAdviceActionToCuration\s*\(/);
    expect(curationBlock![0]).not.toMatch(/dbService\.addToCuration/);
    expect(curationBlock![0]).not.toMatch(/getLatestAdvice/);
    expect(source).not.toMatch(/user_admin_01/);
  });

  it('curation #14 delegates handleCurationFormSubmit — no direct dbService.decideCuration/decideSignal', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/curationHandlers.ts'), 'utf8');
    const block = source.match(/export function handleCurationFormSubmit[\s\S]*?^}/m);
    expect(block).toBeTruthy();
    expect(block![0]).toMatch(/decideCuration\s*\(/);
    expect(block![0]).toMatch(/discardSignalForCurationComposite\s*\(/);
    expect(block![0]).not.toMatch(/dbService\.decideCuration/);
    expect(block![0]).not.toMatch(/dbService\.decideSignal/);
    expect(source).not.toMatch(/user_admin_01/);
  });

  it('no production handler direct dbService.addToCuration remains', () => {
    for (const file of ['src/ui/legacy/handlers/radarHandlers.ts', 'src/ui/legacy/handlers/advisorHandlers.ts']) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/dbService\.addToCuration\s*\(/);
    }
  });
});
