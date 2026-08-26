/**
 * SPEC-004 Phase 2 — Application use-case tests (T-004-201…211).
 */

import { describe, expect, it } from 'vitest';
import type { StrategicBrief } from '../src/domain/strategicBriefCore';
import type { StrategicPlan } from '../src/domain/strategicPlanCore';
import {
  createActivatePlanItem,
  createAddPlanItem,
  createApproveStrategicPlan,
  createAuthorizePlannedAction,
  createCancelPlanItem,
  createCompletePlanItem,
  createCreateStrategicPlan,
  createProposeStrategicPlan,
  createRejectStrategicPlan,
  createRemovePlanItem,
  createRevalidatePlanAgainstBrief,
  createReviseStrategicPlan,
  StrategicPlanError,
  type PlanWriteUnit,
  type StrategicBriefReader,
  type StrategicPlanHistoryPort,
  type StrategicPlanHistoryRecord,
  type StrategicPlanRepository,
  type TrustedPlanActorContext,
} from '../src/application/strategicPlan';

const NOW = '2026-08-25T20:00:00.000Z';

const TRUSTED: TrustedPlanActorContext = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN',
  organizationId: 'org_test',
  clientId: 'client_test',
  now: NOW,
};

function makeBrief(over: Partial<StrategicBrief> = {}): StrategicBrief {
  const baseDecision = {
    authorizedAction: 'CREATE_CONTENT' as const,
    decisionRationale: 'Clear thesis',
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
  const { decision: decisionOver, ...rest } = over;
  return {
    id: 'brief_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    thesisId: 'th_1',
    signalIds: ['sig_1', 'sig_2'],
    primaryAudience: 'GC',
    geography: 'CO',
    territory: 'AI',
    framework: 'Preventive',
    whyNow: { reason: 'NIST', score: 10 },
    strategicAngle: 'Board narrative',
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

function buildHarness(opts?: { briefs?: Record<string, StrategicBrief> }) {
  const planStore = new Map<string, StrategicPlan>();
  const idem = new Map<string, string>();
  const briefStore = new Map<string, StrategicBrief>();
  const historyEntries: StrategicPlanHistoryRecord[] = [];
  const writeUnits: PlanWriteUnit[] = [];

  for (const b of Object.values(opts?.briefs ?? { brief_1: makeBrief() })) {
    briefStore.set(b.id, b);
  }

  const plans: StrategicPlanRepository = {
    getById(planId, tenant) {
      const found = planStore.get(planId);
      if (!found) return undefined;
      if (
        found.organizationId !== tenant.organizationId ||
        found.clientId !== tenant.clientId
      ) {
        return undefined;
      }
      return structuredClone(found);
    },
    findCurrentByBriefRevision(tenant, briefId, briefVersion) {
      for (const plan of planStore.values()) {
        if (plan.organizationId !== tenant.organizationId) continue;
        if (plan.clientId !== tenant.clientId) continue;
        if (plan.strategicBriefId !== briefId) continue;
        if (plan.strategicBriefVersion !== briefVersion) continue;
        if (plan.status === 'SUPERSEDED') continue;
        return structuredClone(plan);
      }
      return undefined;
    },
    findByIdempotencyKey(tenant, key) {
      const scoped = `${tenant.organizationId}|${tenant.clientId}|${key}`;
      const planId = idem.get(scoped);
      return planId ? { planId } : undefined;
    },
    commitWriteUnit(unit) {
      writeUnits.push(unit);
      for (const plan of unit.plans) {
        planStore.set(plan.id, structuredClone(plan));
      }
      for (const entry of unit.idempotencyKeys ?? []) {
        const scoped = `${entry.organizationId}|${entry.clientId}|${entry.key}`;
        idem.set(scoped, entry.planId);
      }
    },
  };

  const history: StrategicPlanHistoryPort = {
    append: (entry) => {
      historyEntries.push(entry);
    },
  };

  const briefs: StrategicBriefReader = {
    getById(briefId, tenant) {
      const found = briefStore.get(briefId);
      if (!found) return undefined;
      if (
        found.organizationId !== tenant.organizationId ||
        found.clientId !== tenant.clientId
      ) {
        return undefined;
      }
      return structuredClone(found);
    },
  };

  const deps = { plans, history, briefs };
  return {
    planStore,
    briefStore,
    historyEntries,
    writeUnits,
    create: createCreateStrategicPlan(deps),
    addItem: createAddPlanItem(deps),
    removeItem: createRemovePlanItem(deps),
    propose: createProposeStrategicPlan(deps),
    approve: createApproveStrategicPlan(deps),
    reject: createRejectStrategicPlan(deps),
    revise: createReviseStrategicPlan(deps),
    authorize: createAuthorizePlannedAction(deps),
    activate: createActivatePlanItem(deps),
    complete: createCompletePlanItem(deps),
    cancel: createCancelPlanItem(deps),
    revalidate: createRevalidatePlanAgainstBrief(deps),
    setBrief(brief: StrategicBrief) {
      briefStore.set(brief.id, brief);
    },
  };
}

async function seedApprovedPlan(
  h: ReturnType<typeof buildHarness>,
  over?: { planId?: string; itemId?: string; action?: 'CREATE_CONTENT' | 'RESEARCH_ONLY' }
) {
  const planId = over?.planId ?? 'plan_1';
  const itemId = over?.itemId ?? 'item_1';
  h.create({
    trusted: TRUSTED,
    planId,
    strategicBriefId: 'brief_1',
    rationale: 'Execute brief',
    intentKey: `create-${planId}`,
  });
  h.addItem({
    trusted: TRUSTED,
    planId,
    itemId,
    action: over?.action ?? 'CREATE_CONTENT',
    order: 0,
    rationale: 'Ship',
    intentKey: `add-${itemId}`,
  });
  h.propose({ trusted: TRUSTED, planId });
  return h.approve({ trusted: TRUSTED, planId }).plan;
}

describe('SPEC-004 Phase 2 — trusted context / spoof (T-004-201/204/209)', () => {
  it('requires trusted actor context', () => {
    const h = buildHarness();
    expect(() =>
      h.create({
        trusted: { ...TRUSTED, actorId: '' },
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'k1',
      })
    ).toThrow(StrategicPlanError);
  });

  it('denies caller tenant spoof', () => {
    const h = buildHarness();
    expect(() =>
      h.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'k1',
        claimedOrganizationId: 'org_evil',
      })
    ).toThrowError(/organizationId/);
  });

  it('ignores caller forged approvedBy / actorKind / role / softwareAuthority on approve', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'k1',
    });
    h.propose({ trusted: TRUSTED, planId: 'plan_1' });
    const result = h.approve({
      trusted: TRUSTED,
      planId: 'plan_1',
      approvedBy: 'attacker',
      actorKind: 'AI',
      actorType: 'HUMAN',
      role: 'ADMIN',
      softwareAuthority: true,
      forgedPlan: { status: 'APPROVED', version: 99, approvedBy: 'attacker' },
    });
    expect(result.plan.approvedBy).toBe('mgr_ana');
    expect(result.plan.status).toBe('APPROVED');
    expect(result.plan.version).toBe(1);
  });

  it('SOFTWARE trusted context cannot approve', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'k1',
    });
    h.propose({ trusted: TRUSTED, planId: 'plan_1' });
    expect(() =>
      h.approve({
        trusted: { ...TRUSTED, softwareAuthority: true },
        planId: 'plan_1',
      })
    ).toThrowError(/SOFTWARE cannot approve/);
  });
});

describe('SPEC-004 Phase 2 — CreateStrategicPlan + Brief authority (T-004-201)', () => {
  it('creates plan from current APPROVED Brief via reader', () => {
    const h = buildHarness();
    const result = h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'Execute',
      intentKey: 'c1',
      forgedBrief: { status: 'DRAFT', version: 99, thesisId: 'evil' },
      claimedThesisId: 'evil_thesis',
    });
    expect(result.created).toBe(true);
    expect(result.plan.thesisId).toBe('th_1');
    expect(result.plan.strategicBriefVersion).toBe(1);
    expect(result.plan.authorizedAction).toBe('CREATE_CONTENT');
    expect(result.plan.signalIds).toEqual(['sig_1', 'sig_2']);
  });

  it('denies non-approved Brief', () => {
    const h = buildHarness({
      briefs: { brief_1: makeBrief({ status: 'DRAFT' }) },
    });
    expect(() =>
      h.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'c1',
      })
    ).toThrow(StrategicPlanError);
  });

  it('denies superseded Brief', () => {
    const h = buildHarness({
      briefs: { brief_1: makeBrief({ status: 'SUPERSEDED' }) },
    });
    expect(() =>
      h.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'c1',
      })
    ).toThrowError(/SUPERSEDED/);
  });

  it('denies multi-Brief aggregation', () => {
    const h = buildHarness();
    expect(() =>
      h.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'c1',
        additionalBriefIds: ['brief_2'],
      })
    ).toThrowError(/multiple Briefs/);
  });

  it('create is idempotent for same intent key', () => {
    const h = buildHarness();
    const a = h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'same',
    });
    const b = h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'same',
    });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.plan.id).toBe('plan_1');
  });

  it('denies Brief tenant mismatch (cross-org)', () => {
    const h = buildHarness({
      briefs: {
        brief_1: makeBrief({ organizationId: 'org_other', clientId: 'client_test' }),
      },
    });
    expect(() =>
      h.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'c1',
      })
    ).toThrow(StrategicPlanError);
  });

  it('denies cross-client Brief', () => {
    const h = buildHarness({
      briefs: {
        brief_1: makeBrief({ clientId: 'client_other' }),
      },
    });
    expect(() =>
      h.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'c1',
      })
    ).toThrow(StrategicPlanError);
  });
});

describe('SPEC-004 Phase 2 — PlanItem / NONE / RESEARCH_ONLY (T-004-202)', () => {
  it('adds item bounded by Brief authorizedAction', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    const result = h.addItem({
      trusted: TRUSTED,
      planId: 'plan_1',
      itemId: 'item_1',
      action: 'CREATE_CONTENT',
      order: 0,
      rationale: 'Ship',
      intentKey: 'i1',
    });
    expect(result.item.status).toBe('READY');
    expect(result.item.action).toBe('CREATE_CONTENT');
  });

  it('denies NONE action items', () => {
    const h = buildHarness({
      briefs: {
        brief_1: makeBrief({
          decision: {
            ...makeBrief().decision,
            authorizedAction: 'NONE',
          },
        }),
      },
    });
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    expect(() =>
      h.addItem({
        trusted: TRUSTED,
        planId: 'plan_1',
        itemId: 'item_1',
        action: 'NONE',
        order: 0,
        rationale: 'Nope',
        intentKey: 'i1',
      })
    ).toThrow(StrategicPlanError);
  });

  it('RESEARCH_ONLY cannot silently become CREATE_CONTENT', () => {
    const h = buildHarness({
      briefs: {
        brief_1: makeBrief({
          decision: {
            ...makeBrief().decision,
            authorizedAction: 'RESEARCH_ONLY',
          },
        }),
      },
    });
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    expect(() =>
      h.addItem({
        trusted: TRUSTED,
        planId: 'plan_1',
        itemId: 'item_1',
        action: 'CREATE_CONTENT',
        order: 0,
        rationale: 'Upgrade',
        intentKey: 'i1',
      })
    ).toThrowError(/not authorized/);
  });
});

describe('SPEC-004 Phase 2 — Approve / Reject / Authorize (T-004-203/204/206)', () => {
  it('approve uses trusted human and is idempotent', async () => {
    const h = buildHarness();
    const plan = await seedApprovedPlan(h);
    expect(plan.status).toBe('APPROVED');
    expect(plan.approvedBy).toBe('mgr_ana');
    const again = h.approve({ trusted: TRUSTED, planId: 'plan_1' });
    expect(again.alreadyApproved).toBe(true);
  });

  it('reject requires reason and HUMAN trusted context', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    h.propose({ trusted: TRUSTED, planId: 'plan_1' });
    expect(() =>
      h.reject({ trusted: TRUSTED, planId: 'plan_1', reason: '' })
    ).toThrow(/reason/);
    const rejected = h.reject({
      trusted: TRUSTED,
      planId: 'plan_1',
      reason: 'Not aligned',
      actorKind: 'AI',
    });
    expect(rejected.plan.status).toBe('REJECTED');
  });

  it('AuthorizePlannedAction uses repository Plan + reader Brief; ignores forged snapshots', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    const result = h.authorize({
      trusted: TRUSTED,
      planId: 'plan_1',
      planItemId: 'item_1',
      forgedPlan: { status: 'DRAFT', approvedBy: null, version: 99 },
      forgedBrief: { status: 'SUPERSEDED', version: 99 },
      forgedHistoryApproved: true,
      actorKind: 'AI',
    });
    expect(result.decision.allowed).toBe(true);
    expect(result.planStatus).toBe('APPROVED');
    expect(result.decision.reasons).toContain('spec006_publication_not_evaluated');
  });

  it('DRAFT plan cannot authorize execution', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    h.addItem({
      trusted: TRUSTED,
      planId: 'plan_1',
      itemId: 'item_1',
      action: 'CREATE_CONTENT',
      order: 0,
      rationale: 'Ship',
      intentKey: 'i1',
    });
    expect(() =>
      h.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow(StrategicPlanError);
  });

  it('stale Brief version fails closed on authorize', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    h.setBrief(makeBrief({ version: 2 }));
    expect(() =>
      h.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow(StrategicPlanError);
  });

  it('superseded Brief fails closed on authorize', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    h.setBrief(makeBrief({ status: 'SUPERSEDED' }));
    expect(() =>
      h.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow(StrategicPlanError);
  });

  it('history PLAN_APPROVED cannot authorize when current plan SUPERSEDED', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    h.revise({
      trusted: TRUSTED,
      priorPlanId: 'plan_1',
      nextPlanId: 'plan_2',
      rationale: 'Material change',
      items: [
        {
          id: 'item_2',
          action: 'CREATE_CONTENT',
          order: 0,
          rationale: 'New item',
        },
      ],
    });
    expect(h.historyEntries.some((e) => e.event === 'PLAN_APPROVED')).toBe(true);
    expect(() =>
      h.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow(/SUPERSEDED|not found|PLAN_/i);
  });
});

describe('SPEC-004 Phase 2 — Activate / Revise / Revalidate (T-004-205/207/208)', () => {
  it('activate after authorize moves item IN_PROGRESS and plan ACTIVE', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    const result = h.activate({
      trusted: TRUSTED,
      planId: 'plan_1',
      planItemId: 'item_1',
    });
    expect(result.item.status).toBe('IN_PROGRESS');
    expect(result.plan.status).toBe('ACTIVE');
    const again = h.activate({
      trusted: TRUSTED,
      planId: 'plan_1',
      planItemId: 'item_1',
    });
    expect(again.writeUnitCommitted).toBe(false);
  });

  it('complete and cancel item lifecycle', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    h.activate({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' });
    const done = h.complete({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' });
    expect(done.item.status).toBe('DONE');

    const h2 = buildHarness();
    await seedApprovedPlan(h2);
    const cancelled = h2.cancel({
      trusted: TRUSTED,
      planId: 'plan_1',
      planItemId: 'item_1',
    });
    expect(cancelled.item.status).toBe('CANCELLED');
  });

  it('material revise supersedes prior and requires re-approval for execution', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    const revised = h.revise({
      trusted: TRUSTED,
      priorPlanId: 'plan_1',
      nextPlanId: 'plan_2',
      rationale: 'New material',
      items: [
        {
          id: 'item_n',
          action: 'CREATE_CONTENT',
          order: 0,
          rationale: 'Revised',
        },
      ],
    });
    expect(revised.prior.status).toBe('SUPERSEDED');
    expect(revised.next.status).toBe('DRAFT');
    expect(revised.next.approvedBy).toBeNull();
    expect(revised.next.version).toBe(2);
    expect(() =>
      h.authorize({ trusted: TRUSTED, planId: 'plan_2', planItemId: 'item_n' })
    ).toThrow(StrategicPlanError);
  });

  it('revalidate fails closed when Brief version drifts', async () => {
    const h = buildHarness();
    await seedApprovedPlan(h);
    const ok = h.revalidate({ trusted: TRUSTED, planId: 'plan_1' });
    expect(ok.valid).toBe(true);
    h.setBrief(makeBrief({ version: 3 }));
    expect(() => h.revalidate({ trusted: TRUSTED, planId: 'plan_1' })).toThrow(
      StrategicPlanError
    );
  });
});

describe('SPEC-004 Phase 2 — multi-thesis + same-id isolation', () => {
  it('one client can have multiple thesis plans as separate plans', () => {
    const briefA = makeBrief({ id: 'brief_a', thesisId: 'th_a' });
    const briefB = makeBrief({
      id: 'brief_b',
      thesisId: 'th_b',
      decision: { ...makeBrief().decision, authorizedAction: 'CREATE_TASK' },
    });
    const h = buildHarness({ briefs: { brief_a: briefA, brief_b: briefB } });
    const a = h.create({
      trusted: TRUSTED,
      planId: 'plan_a',
      strategicBriefId: 'brief_a',
      rationale: 'A',
      intentKey: 'a',
    });
    const b = h.create({
      trusted: TRUSTED,
      planId: 'plan_b',
      strategicBriefId: 'brief_b',
      rationale: 'B',
      intentKey: 'b',
    });
    expect(a.plan.thesisId).toBe('th_a');
    expect(b.plan.thesisId).toBe('th_b');
  });

  it('same plan id across different tenants does not leak', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_shared',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    expect(() =>
      h.authorize({
        trusted: {
          ...TRUSTED,
          organizationId: 'org_other',
          clientId: 'client_other',
        },
        planId: 'plan_shared',
        planItemId: 'item_1',
      })
    ).toThrow(StrategicPlanError);
  });
});
