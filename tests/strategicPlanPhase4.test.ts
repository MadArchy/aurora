/**
 * SPEC-004 Phase 4 — Consumer strangler / planned authorization (T-004-401…406).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StrategicBrief } from '../src/domain/strategicBriefCore';
import { composeStrategicPlan } from '../src/composition/strategicPlan/composeStrategicPlan';
import { createLocalStrategicPlanStore } from '../src/infrastructure/strategicPlan';
import { authorizeContentPublicationGate } from '../src/composition/claimEvidence/contentClaimPublicationGate';
import { createLocalClaimEvidenceStore } from '../src/infrastructure/claimEvidence';
import { resetClaimEvidenceRuntimeForTest } from '../src/composition/claimEvidence/contentClaimPublicationGate';

const NOW = '2026-08-25T23:00:00.000Z';

const TRUSTED = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN' as const,
  organizationId: 'org_test',
  clientId: 'client_test',
  now: NOW,
};

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      uid: 'mgr_ana',
      role: 'ADMIN',
      email: 'mgr@test',
      displayName: 'Mgr',
    }),
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: (id: string) =>
      id === 'client_test'
        ? { id: 'client_test', organizationId: 'org_test', name: 'Test' }
        : undefined,
    getContentById: () => undefined,
    getEvidenceById: () => undefined,
  },
}));

function makeBrief(over: Partial<StrategicBrief> = {}): StrategicBrief {
  const { decision: decisionOver, ...rest } = over;
  const baseDecision = {
    authorizedAction: 'CREATE_CONTENT' as const,
    decisionRationale: 'Clear',
    dispositionDecision: 'SAVE' as const,
    formatDecision: 'ARTICLE' as const,
    upstreamRoutingRef: {
      routingState: 'CLEAR' as const,
      governedThesisId: 'th_1',
      routingAlgorithmVersion: 'routing-v1',
      routingSource: 'AUTO' as const,
      routedAt: NOW,
    },
    upstreamScoreRef: {
      scoringVersion: 'scoring-v1',
      totalScore: 80,
      priorityBand: 'HIGH' as const,
      scoredAt: NOW,
    },
    signalContextRefs: [] as [],
  };
  return {
    id: 'brief_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    thesisId: 'th_1',
    signalIds: ['sig_1'],
    primaryAudience: 'GC',
    geography: 'CO',
    territory: 'AI',
    framework: 'Preventive',
    whyNow: { reason: 'NIST', score: 10 },
    strategicAngle: 'Board',
    supportingEvidenceIds: ['ev_1'],
    riskFlags: [],
    recommendedChannel: 'LINKEDIN',
    recommendedFormat: 'ARTICLE',
    CTA: 'Book',
    status: 'APPROVED',
    createdBy: 'mgr_ana',
    approvedBy: 'mgr_ana',
    version: 1,
    schemaVersion: 'strategic-brief-v1',
    createdAt: NOW,
    updatedAt: NOW,
    approvedAt: NOW,
    ...rest,
    decision: { ...baseDecision, ...(decisionOver ?? {}) },
  };
}

function buildCompose(brief: StrategicBrief = makeBrief()) {
  const store = createLocalStrategicPlanStore();
  store.resetForTest();
  const briefMap = new Map([[`${brief.organizationId}|${brief.clientId}|${brief.id}`, brief]]);
  const uc = composeStrategicPlan({
    store,
    briefs: {
      getById(id, tenant) {
        return briefMap.get(`${tenant.organizationId}|${tenant.clientId}|${id}`);
      },
    },
  });
  return { store, briefMap, setBrief: (b: StrategicBrief) => {
    briefMap.set(`${b.organizationId}|${b.clientId}|${b.id}`, b);
  }, ...uc };
}

async function seedApprovedPlan(
  uc: ReturnType<typeof buildCompose>,
  action: 'CREATE_CONTENT' | 'CREATE_TASK' | 'CREATE_OPPORTUNITY' | 'RESEARCH_ONLY' = 'CREATE_CONTENT'
) {
  uc.create({
    trusted: TRUSTED,
    planId: 'plan_1',
    strategicBriefId: 'brief_1',
    rationale: 'Execute brief',
    intentKey: 'c1',
  });
  uc.addItem({
    trusted: TRUSTED,
    planId: 'plan_1',
    itemId: 'item_1',
    action,
    order: 0,
    rationale: 'Ship',
    intentKey: 'i1',
  });
  uc.propose({ trusted: TRUSTED, planId: 'plan_1' });
  return uc.approve({ trusted: TRUSTED, planId: 'plan_1' }).plan;
}

describe('SPEC-004 Phase 4 — content / opportunity / task planned authorization (T-004-401/402)', () => {
  it('CREATE_CONTENT authorize allows only with approved Plan + READY item', async () => {
    const uc = buildCompose();
    await seedApprovedPlan(uc, 'CREATE_CONTENT');
    const result = uc.authorize({
      trusted: TRUSTED,
      planId: 'plan_1',
      planItemId: 'item_1',
      forgedPlan: { status: 'DRAFT' },
    });
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.reasons).toContain('spec006_publication_not_evaluated');
  });

  it('Planner deny prevents executable authority for CREATE_CONTENT', () => {
    const uc = buildCompose();
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    uc.addItem({
      trusted: TRUSTED,
      planId: 'plan_1',
      itemId: 'item_1',
      action: 'CREATE_CONTENT',
      order: 0,
      rationale: 'Ship',
      intentKey: 'i1',
    });
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('NONE produces no executable PlanItem / authorize path', () => {
    const uc = buildCompose(
      makeBrief({
        decision: { ...makeBrief().decision, authorizedAction: 'NONE' },
      })
    );
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'doc',
      intentKey: 'c1',
    });
    expect(() =>
      uc.addItem({
        trusted: TRUSTED,
        planId: 'plan_1',
        itemId: 'item_1',
        action: 'CREATE_CONTENT',
        order: 0,
        rationale: 'nope',
        intentKey: 'i1',
      })
    ).toThrow();
  });

  it('RESEARCH_ONLY cannot escalate to CREATE_CONTENT', () => {
    const uc = buildCompose(
      makeBrief({
        decision: { ...makeBrief().decision, authorizedAction: 'RESEARCH_ONLY' },
      })
    );
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'research',
      intentKey: 'c1',
    });
    expect(() =>
      uc.addItem({
        trusted: TRUSTED,
        planId: 'plan_1',
        itemId: 'item_1',
        action: 'CREATE_CONTENT',
        order: 0,
        rationale: 'escalate',
        intentKey: 'i1',
      })
    ).toThrow();
  });

  it('CREATE_OPPORTUNITY and CREATE_TASK authorize when Plan allows', async () => {
    const oppBrief = makeBrief({
      id: 'brief_opp',
      decision: { ...makeBrief().decision, authorizedAction: 'CREATE_OPPORTUNITY' },
    });
    const ucOpp = buildCompose(oppBrief);
    ucOpp.create({
      trusted: TRUSTED,
      planId: 'plan_opp',
      strategicBriefId: 'brief_opp',
      rationale: 'opp',
      intentKey: 'o1',
    });
    ucOpp.addItem({
      trusted: TRUSTED,
      planId: 'plan_opp',
      itemId: 'item_opp',
      action: 'CREATE_OPPORTUNITY',
      order: 0,
      rationale: 'Create opp',
      intentKey: 'oi1',
    });
    ucOpp.propose({ trusted: TRUSTED, planId: 'plan_opp' });
    ucOpp.approve({ trusted: TRUSTED, planId: 'plan_opp' });
    expect(
      ucOpp.authorize({
        trusted: TRUSTED,
        planId: 'plan_opp',
        planItemId: 'item_opp',
      }).decision.allowed
    ).toBe(true);

    const taskBrief = makeBrief({
      id: 'brief_task',
      decision: { ...makeBrief().decision, authorizedAction: 'CREATE_TASK' },
    });
    const ucTask = buildCompose(taskBrief);
    ucTask.create({
      trusted: TRUSTED,
      planId: 'plan_task',
      strategicBriefId: 'brief_task',
      rationale: 'task',
      intentKey: 't1',
    });
    ucTask.addItem({
      trusted: TRUSTED,
      planId: 'plan_task',
      itemId: 'item_task',
      action: 'CREATE_TASK',
      order: 0,
      rationale: 'Create task',
      intentKey: 'ti1',
    });
    ucTask.propose({ trusted: TRUSTED, planId: 'plan_task' });
    ucTask.approve({ trusted: TRUSTED, planId: 'plan_task' });
    expect(
      ucTask.authorize({
        trusted: TRUSTED,
        planId: 'plan_task',
        planItemId: 'item_task',
      }).decision.allowed
    ).toBe(true);
  });
});

describe('SPEC-004 Phase 4 — delivery / stale / history / demotion (T-004-403/404)', () => {
  it('stale Brief after Plan approve fails closed', async () => {
    const uc = buildCompose();
    await seedApprovedPlan(uc);
    uc.setBrief(makeBrief({ version: 2 }));
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('superseded Plan cannot authorize', async () => {
    const uc = buildCompose();
    await seedApprovedPlan(uc);
    uc.revise({
      trusted: TRUSTED,
      priorPlanId: 'plan_1',
      nextPlanId: 'plan_2',
      rationale: 'revise',
      items: [
        {
          id: 'item_2',
          action: 'CREATE_CONTENT',
          order: 0,
          rationale: 'new',
        },
      ],
    });
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('history PLAN_APPROVED does not authorize SUPERSEDED plan', async () => {
    const uc = buildCompose();
    await seedApprovedPlan(uc);
    uc.revise({
      trusted: TRUSTED,
      priorPlanId: 'plan_1',
      nextPlanId: 'plan_2',
      rationale: 'revise',
      items: [
        { id: 'item_n', action: 'CREATE_CONTENT', order: 0, rationale: 'n' },
      ],
    });
    expect(uc.store.listHistory().some((e) => e.event === 'PLAN_APPROVED')).toBe(true);
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('CurationEntry-like status is not Plan authority (helper + missing plan deny)', async () => {
    const { assertCurationNotPlanAuthority } = await import(
      '../src/services/strategicPlanConsumer'
    );
    expect(() =>
      assertCurationNotPlanAuthority({ status: 'APPROVED', decision: 'CREATE_CONTENT' })
    ).not.toThrow();

    const uc = buildCompose();
    // No plan created — execution cannot proceed from curation alone.
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'missing', planItemId: 'x' })
    ).toThrow();
  });
});

describe('SPEC-004 Phase 4 — SPEC-006 publication remains separate (T-004-405/406)', () => {
  beforeEach(() => {
    resetClaimEvidenceRuntimeForTest();
  });

  it('Planner allow does not imply SPEC-006 publication allow', async () => {
    const uc = buildCompose();
    await seedApprovedPlan(uc);
    const planned = uc.authorize({
      trusted: TRUSTED,
      planId: 'plan_1',
      planItemId: 'item_1',
    });
    expect(planned.decision.allowed).toBe(true);

    const claimStore = createLocalClaimEvidenceStore();
    claimStore.resetForTest();
    // Content with claims requiring evidence would block — empty claims = NO_CLAIMS pass per Domain.
    // Demonstrate gate is still invoked independently (not skipped because Plan APPROVED).
    const gate = authorizeContentPublicationGate({
      contentId: 'content_missing',
      organizationId: 'org_test',
      clientId: 'client_test',
      targetStatus: 'READY',
      actorId: 'mgr_ana',
      actorRole: 'ADMIN',
      now: NOW,
      store: claimStore,
    });
    // Missing content → fail closed at SPEC-006 composition, independent of Plan.
    expect(gate.allowed).toBe(false);
  });
});

describe('SPEC-004 Phase 4 — consumer facade requirePlannedAuthorization', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('denies when Brief ok but no StrategicPlan exists (no curation fallback)', async () => {
    vi.doMock('../src/services/strategicBriefConsumer', () => ({
      requireStrategicAuthorization: () => ({
        authorized: true,
        briefId: 'brief_1',
        version: 1,
      }),
      getStrategicBrief: () => makeBrief(),
      formatAuthorizationDenial: () => 'brief denied',
    }));
    const { resetStrategicPlanConsumerForTest, requirePlannedAuthorization } = await import(
      '../src/services/strategicPlanConsumer'
    );
    resetStrategicPlanConsumerForTest();
    const result = requirePlannedAuthorization({
      clientId: 'client_test',
      briefId: 'brief_1',
      requestedAction: 'CREATE_CONTENT',
      forgedPlan: { status: 'APPROVED', approvedBy: 'attacker' },
    });
    expect(result.authorized).toBe(false);
    expect(result.denialCode).toBe('PLAN_NOT_FOUND');
  });

  it('ignores forged Plan/Brief snapshots when Plan exists and is approved', async () => {
    vi.doMock('../src/services/strategicBriefConsumer', () => ({
      requireStrategicAuthorization: () => ({
        authorized: true,
        briefId: 'brief_1',
        version: 1,
      }),
      getStrategicBrief: () => makeBrief(),
      formatAuthorizationDenial: () => 'brief denied',
    }));
    const mod = await import('../src/services/strategicPlanConsumer');
    mod.resetStrategicPlanConsumerForTest();
    mod.createStrategicPlanFromBrief({
      clientId: 'client_test',
      briefId: 'brief_1',
      planId: 'plan_1',
      rationale: 'Execute',
      intentKey: 'c1',
      now: NOW,
    });
    mod.addStrategicPlanItem({
      clientId: 'client_test',
      planId: 'plan_1',
      itemId: 'item_1',
      action: 'CREATE_CONTENT',
      order: 0,
      rationale: 'Ship',
      intentKey: 'i1',
      now: NOW,
    });
    mod.proposeStrategicPlan({ clientId: 'client_test', planId: 'plan_1', now: NOW });
    mod.approveStrategicPlan({
      clientId: 'client_test',
      planId: 'plan_1',
      approvedBy: 'attacker',
      actorKind: 'AI',
      now: NOW,
    });
    const result = mod.requirePlannedAuthorization({
      clientId: 'client_test',
      briefId: 'brief_1',
      requestedAction: 'CREATE_CONTENT',
      forgedPlan: { status: 'CANCELLED' },
      forgedBrief: { status: 'SUPERSEDED', version: 99 },
    });
    expect(result.authorized).toBe(true);
    expect(result.planId).toBe('plan_1');
    expect(result.planItemId).toBe('item_1');
  });
});
