/**
 * SPEC-004 Phase 3 — Local-authoritative persistence (T-004-301…307).
 */

import { describe, expect, it } from 'vitest';
import type { StrategicBrief } from '../src/domain/strategicBriefCore';
import {
  createActivatePlanItem,
  createAddPlanItem,
  createApproveStrategicPlan,
  createAuthorizePlannedAction,
  createCreateStrategicPlan,
  createProposeStrategicPlan,
  createRevalidatePlanAgainstBrief,
  StrategicPlanError,
  type TrustedPlanActorContext,
} from '../src/application/strategicPlan';
import {
  createLocalStrategicPlanStore,
  LocalPlanItemStore,
  LocalStrategicBriefReader,
  LocalStrategicPlanHistoryAdapter,
  LocalStrategicPlanRepository,
  PLAN_CURRENT_STORE_SCHEMA,
  STRATEGIC_PLAN_CURRENT_STORE_KEY,
  STRATEGIC_PLAN_HISTORY_STORE_KEY,
  STRATEGIC_PLAN_IDEMPOTENCY_STORE_KEY,
} from '../src/infrastructure/strategicPlan';
import { parseStoredPlan } from '../src/infrastructure/strategicPlan/serialization';
import type { StrategicPlan } from '../src/domain/strategicPlanCore';

const NOW = '2026-08-25T22:00:00.000Z';

const TRUSTED: TrustedPlanActorContext = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN',
  organizationId: 'org_test',
  clientId: 'client_test',
  now: NOW,
};

function memoryKv() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    data,
  };
}

function makeBrief(over: Partial<StrategicBrief> = {}): StrategicBrief {
  const { decision: decisionOver, ...rest } = over;
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

function buildHarness(opts?: {
  briefs?: Record<string, StrategicBrief>;
  kv?: ReturnType<typeof memoryKv>;
}) {
  const kv = opts?.kv ?? memoryKv();
  const store = createLocalStrategicPlanStore(kv);
  store.resetForTest();
  const plans = new LocalStrategicPlanRepository(store);
  const history = new LocalStrategicPlanHistoryAdapter(store);
  const items = new LocalPlanItemStore(store);
  const briefMap = new Map<string, StrategicBrief>();
  for (const b of Object.values(opts?.briefs ?? { brief_1: makeBrief() })) {
    briefMap.set(`${b.organizationId}|${b.clientId}|${b.id}`, b);
  }
  const briefs = new LocalStrategicBriefReader({
    getById(briefId, tenant) {
      return briefMap.get(`${tenant.organizationId}|${tenant.clientId}|${briefId}`);
    },
  });
  const deps = { plans, history, briefs };
  return {
    kv,
    store,
    plans,
    history,
    items,
    briefMap,
    create: createCreateStrategicPlan(deps),
    addItem: createAddPlanItem(deps),
    propose: createProposeStrategicPlan(deps),
    approve: createApproveStrategicPlan(deps),
    authorize: createAuthorizePlannedAction(deps),
    activate: createActivatePlanItem(deps),
    revalidate: createRevalidatePlanAgainstBrief(deps),
    setBrief(brief: StrategicBrief) {
      briefMap.set(`${brief.organizationId}|${brief.clientId}|${brief.id}`, brief);
    },
  };
}

function validPlan(over: Partial<StrategicPlan> = {}): StrategicPlan {
  return {
    id: 'plan_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    strategicBriefId: 'brief_1',
    strategicBriefVersion: 1,
    thesisId: 'th_1',
    signalIds: ['sig_1'],
    authorizedAction: 'CREATE_CONTENT',
    status: 'DRAFT',
    version: 1,
    schemaVersion: 'strategic-plan-v1',
    createdBy: 'mgr_ana',
    approvedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    rationale: 'Execute',
    priorityBand: null,
    aiAdvisoryRefs: [],
    supersededByPlanId: null,
    supersedesPlanId: null,
    items: [],
    ...over,
  };
}

describe('SPEC-004 Phase 3 — repository / item / history round-trip (T-004-301/302/303)', () => {
  it('persists StrategicPlan + PlanItems and reloads via new adapter instance', () => {
    const kv = memoryKv();
    const h = buildHarness({ kv });
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'Execute',
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

    const store2 = createLocalStrategicPlanStore(kv);
    const plans2 = new LocalStrategicPlanRepository(store2);
    const loaded = plans2.getById('plan_1', TRUSTED);
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.strategicBriefId).toBe('brief_1');
    expect(loaded?.thesisId).toBe('th_1');
    expect(loaded?.authorizedAction).toBe('CREATE_CONTENT');

    const itemStore = new LocalPlanItemStore(store2);
    expect(itemStore.listByPlan('plan_1', TRUSTED)[0]?.id).toBe('item_1');
  });

  it('appends history without replace and history is not execution authority', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    const before = h.store.listHistory().length;
    h.history.append({
      id: 'hist_manual',
      organizationId: 'org_test',
      clientId: 'client_test',
      planId: 'plan_1',
      planVersion: 1,
      event: 'PLAN_APPROVED',
      actorId: 'forger',
      at: NOW,
    });
    h.history.append({
      id: 'hist_manual',
      organizationId: 'org_test',
      clientId: 'client_test',
      planId: 'plan_1',
      planVersion: 1,
      event: 'PLAN_APPROVED',
      actorId: 'forger',
      at: NOW,
    });
    expect(h.store.listHistory().length).toBe(before + 1);
    expect(() =>
      h.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow(StrategicPlanError);
  });
});

describe('SPEC-004 Phase 3 — tenant keys + same-id isolation (T-004-305)', () => {
  it('isolates same plan id across organizations and clients', () => {
    const h = buildHarness({
      briefs: {
        a: makeBrief({ id: 'brief_1', organizationId: 'org_a', clientId: 'client_a' }),
        b: makeBrief({ id: 'brief_1', organizationId: 'org_b', clientId: 'client_b' }),
        c: makeBrief({ id: 'brief_1', organizationId: 'org_a', clientId: 'client_b' }),
      },
    });
    h.create({
      trusted: { ...TRUSTED, organizationId: 'org_a', clientId: 'client_a' },
      planId: 'plan_shared',
      strategicBriefId: 'brief_1',
      rationale: 'A',
      intentKey: 'a',
    });
    h.create({
      trusted: { ...TRUSTED, organizationId: 'org_b', clientId: 'client_b' },
      planId: 'plan_shared',
      strategicBriefId: 'brief_1',
      rationale: 'B',
      intentKey: 'b',
    });
    h.create({
      trusted: { ...TRUSTED, organizationId: 'org_a', clientId: 'client_b' },
      planId: 'plan_shared',
      strategicBriefId: 'brief_1',
      rationale: 'C',
      intentKey: 'c',
    });
    expect(
      h.plans.getById('plan_shared', { organizationId: 'org_a', clientId: 'client_a' })
        ?.rationale
    ).toBe('A');
    expect(
      h.plans.getById('plan_shared', { organizationId: 'org_b', clientId: 'client_b' })
        ?.rationale
    ).toBe('B');
    expect(
      h.plans.getById('plan_shared', { organizationId: 'org_a', clientId: 'client_a' })
    ).not.toEqual(
      h.plans.getById('plan_shared', { organizationId: 'org_b', clientId: 'client_b' })
    );
  });
});

describe('SPEC-004 Phase 3 — version / duplicate current / stale write (T-004-305/306)', () => {
  it('denies stale version overwrite', () => {
    const h = buildHarness();
    const plan = validPlan({ version: 2, status: 'APPROVED', approvedBy: 'mgr_ana' });
    h.store.commitWriteUnit({ plans: [plan], history: [] });
    expect(() =>
      h.store.commitWriteUnit({
        plans: [validPlan({ version: 1, status: 'DRAFT' })],
        history: [],
      })
    ).toThrow(/Stale write|IDEMPOTENCY/);
  });

  it('fails closed on duplicate current plans for same Brief revision', () => {
    const h = buildHarness();
    h.store.commitWriteUnit({
      plans: [validPlan({ id: 'plan_a', status: 'DRAFT' })],
      history: [],
    });
    expect(() =>
      h.store.commitWriteUnit({
        plans: [validPlan({ id: 'plan_b', status: 'PROPOSED' })],
        history: [],
      })
    ).toThrow(/Duplicate current/);
  });
});

describe('SPEC-004 Phase 3 — malformed persistence fail-closed (T-004-301/308)', () => {
  it('rejects malformed Plan missing tenant / thesis / Brief', () => {
    expect(() =>
      parseStoredPlan({
        id: 'plan_1',
        schemaVersion: 'strategic-plan-v1',
        status: 'DRAFT',
        version: 1,
      })
    ).toThrow(StrategicPlanError);

    expect(() =>
      parseStoredPlan({
        ...validPlan(),
        thesisId: '',
      })
    ).toThrow(StrategicPlanError);

    expect(() =>
      parseStoredPlan({
        ...validPlan(),
        schemaVersion: 'plan-v999',
      })
    ).toThrow(/schemaVersion/);
  });

  it('rejects PlanItem with mixed tenant or bad action', () => {
    expect(() =>
      parseStoredPlan({
        ...validPlan(),
        items: [
          {
            id: 'item_1',
            planId: 'plan_1',
            organizationId: 'org_other',
            clientId: 'client_test',
            action: 'CREATE_CONTENT',
            status: 'READY',
            order: 0,
            rationale: 'x',
            channel: null,
            format: null,
            riskNotes: [],
            downstreamRef: null,
            createdAt: NOW,
            updatedAt: NOW,
            schemaVersion: 'plan-item-v1',
          },
        ],
      })
    ).toThrow(/tenant mismatch/);
  });

  it('unknown store schema fails closed on reload', () => {
    const kv = memoryKv();
    kv.setItem(
      STRATEGIC_PLAN_CURRENT_STORE_KEY,
      JSON.stringify({ schemaVersion: 'plan-store-v999', plans: [] })
    );
    const store = createLocalStrategicPlanStore(kv);
    expect(() => store.getById('plan_1', TRUSTED)).toThrow(/schemaVersion/);
  });
});

describe('SPEC-004 Phase 3 — Brief reader + stale Brief after reload (T-004-304)', () => {
  it('Brief reader is tenant-scoped and does not mutate Brief', () => {
    const brief = makeBrief();
    const reader = new LocalStrategicBriefReader({
      getById: (id, tenant) =>
        id === brief.id &&
        tenant.organizationId === brief.organizationId &&
        tenant.clientId === brief.clientId
          ? brief
          : undefined,
    });
    expect(reader.getById('brief_1', TRUSTED)?.status).toBe('APPROVED');
    expect(
      reader.getById('brief_1', { organizationId: 'org_x', clientId: 'client_test' })
    ).toBeUndefined();
  });

  it('stale Brief version still fails after Plan reload', () => {
    const kv = memoryKv();
    const h = buildHarness({ kv });
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
    h.propose({ trusted: TRUSTED, planId: 'plan_1' });
    h.approve({ trusted: TRUSTED, planId: 'plan_1' });

    const store2 = createLocalStrategicPlanStore(kv);
    const plans2 = new LocalStrategicPlanRepository(store2);
    const history2 = new LocalStrategicPlanHistoryAdapter(store2);
    const briefs2 = new LocalStrategicBriefReader({
      getById: () => makeBrief({ version: 2 }),
    });
    const authorize = createAuthorizePlannedAction({
      plans: plans2,
      briefs: briefs2,
    });
    const revalidate = createRevalidatePlanAgainstBrief({
      plans: plans2,
      briefs: briefs2,
    });
    expect(plans2.getById('plan_1', TRUSTED)?.strategicBriefVersion).toBe(1);
    expect(() =>
      authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow(StrategicPlanError);
    expect(() => revalidate({ trusted: TRUSTED, planId: 'plan_1' })).toThrow(
      StrategicPlanError
    );
    void history2;
  });
});

describe('SPEC-004 Phase 3 — write unit coherence + idempotency (T-004-305/306/307)', () => {
  it('rolls back in-memory mutation when persist fails', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    h.store.failBeforePersistForTest = true;
    expect(() =>
      h.store.commitWriteUnit({
        plans: [validPlan({ id: 'plan_2', status: 'DRAFT', strategicBriefId: 'brief_other' })],
        history: [],
      })
    ).toThrow(StrategicPlanError);
    expect(h.store.getById('plan_2', TRUSTED)).toBeUndefined();
    expect(h.store.getById('plan_1', TRUSTED)?.id).toBe('plan_1');
  });

  it('create / add / approve / activate idempotency survives adapter reload', () => {
    const kv = memoryKv();
    const h = buildHarness({ kv });
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'same-create',
    });
    h.addItem({
      trusted: TRUSTED,
      planId: 'plan_1',
      itemId: 'item_1',
      action: 'CREATE_CONTENT',
      order: 0,
      rationale: 'Ship',
      intentKey: 'same-item',
    });
    h.propose({ trusted: TRUSTED, planId: 'plan_1' });
    h.approve({ trusted: TRUSTED, planId: 'plan_1' });
    h.activate({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' });

    const store2 = createLocalStrategicPlanStore(kv);
    const plans2 = new LocalStrategicPlanRepository(store2);
    const history2 = new LocalStrategicPlanHistoryAdapter(store2);
    const briefs2 = new LocalStrategicBriefReader({
      getById: () => makeBrief(),
    });
    const deps = { plans: plans2, history: history2, briefs: briefs2 };
    const create2 = createCreateStrategicPlan(deps);
    const add2 = createAddPlanItem(deps);
    const approve2 = createApproveStrategicPlan(deps);
    const activate2 = createActivatePlanItem(deps);

    expect(
      create2({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'same-create',
      }).created
    ).toBe(false);
    expect(
      add2({
        trusted: TRUSTED,
        planId: 'plan_1',
        itemId: 'item_1',
        action: 'CREATE_CONTENT',
        order: 0,
        rationale: 'Ship',
        intentKey: 'same-item',
      }).created
    ).toBe(false);
    expect(approve2({ trusted: TRUSTED, planId: 'plan_1' }).alreadyApproved).toBe(true);
    expect(
      activate2({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
        .writeUnitCommitted
    ).toBe(false);

    const hist = store2.listHistory();
    const approvedEvents = hist.filter((e) => e.event === 'PLAN_APPROVED');
    expect(approvedEvents.length).toBe(1);
    expect(kv.data.has(STRATEGIC_PLAN_CURRENT_STORE_KEY)).toBe(true);
    expect(kv.data.has(STRATEGIC_PLAN_HISTORY_STORE_KEY)).toBe(true);
    expect(kv.data.has(STRATEGIC_PLAN_IDEMPOTENCY_STORE_KEY)).toBe(true);
    const envelope = JSON.parse(kv.data.get(STRATEGIC_PLAN_CURRENT_STORE_KEY)!);
    expect(envelope.schemaVersion).toBe(PLAN_CURRENT_STORE_SCHEMA);
  });

  it('persists trusted actor on material history', () => {
    const h = buildHarness();
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'c1',
    });
    const created = h.store.listHistory().find((e) => e.event === 'PLAN_CREATED');
    expect(created?.actorId).toBe('mgr_ana');
  });
});

describe('SPEC-004 Phase 3 — NONE remains non-executable after round trip', () => {
  it('NONE brief plan cannot gain executable item authority after reload', () => {
    const kv = memoryKv();
    const h = buildHarness({
      kv,
      briefs: {
        brief_1: makeBrief({
          decision: { ...makeBrief().decision, authorizedAction: 'NONE' },
        }),
      },
    });
    h.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'doc',
      intentKey: 'c1',
    });
    expect(() =>
      h.addItem({
        trusted: TRUSTED,
        planId: 'plan_1',
        itemId: 'item_1',
        action: 'CREATE_CONTENT',
        order: 0,
        rationale: 'nope',
        intentKey: 'i1',
      })
    ).toThrow(StrategicPlanError);
    const store2 = createLocalStrategicPlanStore(kv);
    expect(store2.getById('plan_1', TRUSTED)?.authorizedAction).toBe('NONE');
    expect(store2.getById('plan_1', TRUSTED)?.items).toHaveLength(0);
  });
});
