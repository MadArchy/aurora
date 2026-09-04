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
  createAddSignalToCuration,
  createReviewClientArticle,
  createSaveContentDraft,
  createTransitionClientTask,
  type ContentPublicationGatePort,
  type ContentRepository,
  type ContentStrategicBriefGatePort,
  type CurationRepositoryPort,
  type SignalReadPort,
  type TaskRepository,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { ContentItem, CurationEntry, Signal, Task } from '../src/types';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { TASK_TRANSITIONS } from '../src/domain/stateMachine';
import {
  addSignalToCuration,
  resetExecutionDeliveryConsumerForTest,
} from '../src/services/executionDeliveryConsumer';
import * as executionDeliveryConsumer from '../src/services/executionDeliveryConsumer';
import { authService } from '../src/services/auth';
import { auditService } from '../src/services/audit';
import { dbService } from '../src/services/db';
import { handleSendToCurationClick } from '../src/ui/legacy/handlers/radarHandlers';
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

describe('CR-1 Execution Delivery architecture', () => {
  it('compose exposes five commands including addSignalToCuration', () => {
    const c = composeExecutionDelivery();
    expect(typeof c.transitionClientTask).toBe('function');
    expect(typeof c.saveContentDraft).toBe('function');
    expect(typeof c.reviewClientArticle).toBe('function');
    expect(typeof c.sendDeliveryPackage).toBe('function');
    expect(typeof c.addSignalToCuration).toBe('function');
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

  it('advisor #21a remains legacy direct dbService.addToCuration (B2 deferred)', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/advisorHandlers.ts'), 'utf8');
    expect(source).toMatch(/dbService\.addToCuration\s*\(/);
  });
});
