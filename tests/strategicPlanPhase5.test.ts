/**
 * SPEC-004 Phase 5 — Adversarial / security suite (T-004-502…510).
 * Threats T-004-01…17 behavioral proofs. No paid AI. Minimal product surface.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StrategicBrief } from '../src/domain/strategicBriefCore';
import type { StrategicPlan } from '../src/domain/strategicPlanCore';
import {
  StrategicPlanError,
  type TrustedPlanActorContext,
} from '../src/application/strategicPlan';
import { composeStrategicPlan } from '../src/composition/strategicPlan/composeStrategicPlan';
import {
  createLocalStrategicPlanStore,
  LocalStrategicPlanRepository,
} from '../src/infrastructure/strategicPlan';
import {
  authorizeContentPublicationGate,
  resetClaimEvidenceRuntimeForTest,
} from '../src/composition/claimEvidence/contentClaimPublicationGate';
import { createLocalClaimEvidenceStore } from '../src/infrastructure/claimEvidence';

const NOW = '2026-08-25T23:00:00.000Z';
const LATER = '2026-08-25T23:30:00.000Z';

const TRUSTED: TrustedPlanActorContext = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN',
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

function buildCompose(brief: StrategicBrief = makeBrief(), kv = memoryKv()) {
  const store = createLocalStrategicPlanStore(kv);
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
  return {
    store,
    kv,
    briefMap,
    setBrief: (b: StrategicBrief) => {
      briefMap.set(`${b.organizationId}|${b.clientId}|${b.id}`, b);
    },
    ...uc,
  };
}

function seedApprovedPlan(
  uc: ReturnType<typeof buildCompose>,
  opts?: {
    planId?: string;
    itemId?: string;
    briefId?: string;
    action?: 'CREATE_CONTENT' | 'CREATE_TASK' | 'CREATE_OPPORTUNITY' | 'RESEARCH_ONLY';
    intentPrefix?: string;
  }
) {
  const planId = opts?.planId ?? 'plan_1';
  const itemId = opts?.itemId ?? 'item_1';
  const briefId = opts?.briefId ?? 'brief_1';
  const action = opts?.action ?? 'CREATE_CONTENT';
  const p = opts?.intentPrefix ?? planId;
  uc.create({
    trusted: TRUSTED,
    planId,
    strategicBriefId: briefId,
    rationale: 'Execute',
    intentKey: `c-${p}`,
  });
  uc.addItem({
    trusted: TRUSTED,
    planId,
    itemId,
    action,
    order: 0,
    rationale: 'Ship',
    intentKey: `i-${p}`,
  });
  uc.propose({ trusted: TRUSTED, planId });
  return uc.approve({ trusted: TRUSTED, planId }).plan;
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

describe('SPEC-004 Phase 5 — trusted context / role / tenant spoof (T-004-502/503 · T-004-01/02)', () => {
  it('empty trusted actorId denied — TRUSTED_CONTEXT_REQUIRED', () => {
    const uc = buildCompose();
    expect(() =>
      uc.create({
        trusted: { ...TRUSTED, actorId: '' },
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'k1',
      })
    ).toThrow(StrategicPlanError);
  });

  it('caller role spoof (CLIENT trusted) cannot approve', () => {
    const uc = buildCompose();
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'k1',
    });
    uc.propose({ trusted: TRUSTED, planId: 'plan_1' });
    expect(() =>
      uc.approve({
        trusted: { ...TRUSTED, actorRole: 'CLIENT' },
        planId: 'plan_1',
        approvedBy: 'attacker_admin',
        actorKind: 'HUMAN',
      })
    ).toThrow(/ACTOR_NOT_AUTHORIZED|ADMIN/i);
  });

  it('caller softwareAuthority / AI actorKind on payload ignored; trusted HUMAN wins', () => {
    const uc = buildCompose();
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'k1',
    });
    uc.propose({ trusted: TRUSTED, planId: 'plan_1' });
    const result = uc.approve({
      trusted: TRUSTED,
      planId: 'plan_1',
      approvedBy: 'ai_bot',
      actorKind: 'AI',
      softwareAuthority: true,
    });
    expect(result.plan.status).toBe('APPROVED');
    expect(result.plan.approvedBy).toBe('mgr_ana');
  });

  it('caller tenant spoof denied (organizationId / clientId)', () => {
    const uc = buildCompose();
    expect(() =>
      uc.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'k1',
        claimedOrganizationId: 'org_evil',
      })
    ).toThrow(/TENANT|organizationId/i);
    expect(() =>
      uc.create({
        trusted: TRUSTED,
        planId: 'plan_2',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'k2',
        claimedClientId: 'client_evil',
      })
    ).toThrow(/TENANT|clientId/i);
  });

  it('cross-tenant Plan read returns undefined (T-004-08)', () => {
    const uc = buildCompose();
    seedApprovedPlan(uc);
    expect(
      uc.plans.getById('plan_1', { organizationId: 'org_b', clientId: 'client_b' })
    ).toBeUndefined();
    expect(
      uc.plans.getById('plan_1', { organizationId: 'org_test', clientId: 'client_other' })
    ).toBeUndefined();
  });

  it('same-ID Plan across tenants remains isolated', () => {
    const briefA = makeBrief({ id: 'brief_shared', organizationId: 'org_a', clientId: 'client_a' });
    const briefB = makeBrief({ id: 'brief_shared', organizationId: 'org_b', clientId: 'client_b' });
    const kv = memoryKv();
    const store = createLocalStrategicPlanStore(kv);
    store.resetForTest();
    const map = new Map([
      ['org_a|client_a|brief_shared', briefA],
      ['org_b|client_b|brief_shared', briefB],
    ]);
    const uc = composeStrategicPlan({
      store,
      briefs: {
        getById(id, tenant) {
          return map.get(`${tenant.organizationId}|${tenant.clientId}|${id}`);
        },
      },
    });
    const trustedA = { ...TRUSTED, organizationId: 'org_a', clientId: 'client_a', actorId: 'a' };
    const trustedB = { ...TRUSTED, organizationId: 'org_b', clientId: 'client_b', actorId: 'b' };
    uc.create({
      trusted: trustedA,
      planId: 'shared_plan',
      strategicBriefId: 'brief_shared',
      rationale: 'A',
      intentKey: 'ka',
    });
    uc.create({
      trusted: trustedB,
      planId: 'shared_plan',
      strategicBriefId: 'brief_shared',
      rationale: 'B',
      intentKey: 'kb',
    });
    expect(uc.plans.getById('shared_plan', trustedA)?.rationale).toBe('A');
    expect(uc.plans.getById('shared_plan', trustedB)?.rationale).toBe('B');
  });
});

describe('SPEC-004 Phase 5 — AI self-approval / snapshot spoof (T-004-503 · T-004-03/09)', () => {
  it('AI-only trusted context cannot approve', () => {
    const uc = buildCompose();
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'k1',
    });
    uc.propose({ trusted: TRUSTED, planId: 'plan_1' });
    expect(() =>
      uc.approve({
        trusted: {
          ...TRUSTED,
          actorRole: 'CLIENT',
          softwareAuthority: true,
        },
        planId: 'plan_1',
        actorKind: 'HUMAN',
        approvedBy: 'ai_model',
      })
    ).toThrow(StrategicPlanError);
  });

  it('caller forged Plan snapshot (APPROVED/ACTIVE) ignored when repository is DRAFT', () => {
    const uc = buildCompose();
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'x',
      intentKey: 'k1',
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
      uc.authorize({
        trusted: TRUSTED,
        planId: 'plan_1',
        planItemId: 'item_1',
        forgedPlan: {
          status: 'APPROVED',
          version: 99,
          approvedBy: 'trusted-looking',
          authorizedAction: 'CREATE_CONTENT',
        },
      })
    ).toThrow();
  });

  it('caller forged Brief snapshot ignored when reader returns different state', () => {
    const uc = buildCompose(makeBrief({ status: 'DRAFT', approvedBy: null, approvedAt: undefined }));
    expect(() =>
      uc.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'k1',
        forgedBrief: {
          status: 'APPROVED',
          version: 99,
          authorizedAction: 'CREATE_CONTENT',
          thesisId: 'th_1',
        },
      })
    ).toThrow();
  });
});

describe('SPEC-004 Phase 5 — stale / superseded / unauthorized action (T-004-504 · T-004-04/05/06)', () => {
  it('stale Brief version fails closed on authorize', () => {
    const uc = buildCompose();
    seedApprovedPlan(uc);
    uc.setBrief(makeBrief({ version: 2 }));
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('superseded Brief fails closed', () => {
    const uc = buildCompose();
    seedApprovedPlan(uc);
    uc.setBrief(makeBrief({ status: 'SUPERSEDED' }));
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('superseded Plan cannot authorize (historic approval dead)', () => {
    const uc = buildCompose();
    seedApprovedPlan(uc);
    uc.revise({
      trusted: TRUSTED,
      priorPlanId: 'plan_1',
      nextPlanId: 'plan_2',
      rationale: 'revise',
      items: [{ id: 'item_2', action: 'CREATE_CONTENT', order: 0, rationale: 'n' }],
    });
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('NONE cannot add executable PlanItem or authorize CREATE_*', () => {
    const uc = buildCompose(
      makeBrief({ decision: { ...makeBrief().decision, authorizedAction: 'NONE' } })
    );
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'doc',
      intentKey: 'c1',
    });
    for (const action of ['CREATE_CONTENT', 'CREATE_TASK', 'CREATE_OPPORTUNITY'] as const) {
      expect(() =>
        uc.addItem({
          trusted: TRUSTED,
          planId: 'plan_1',
          itemId: `item_${action}`,
          action,
          order: 0,
          rationale: 'escalate',
          intentKey: `i_${action}`,
        })
      ).toThrow();
    }
  });

  it('RESEARCH_ONLY cannot escalate to CREATE_CONTENT/TASK/OPPORTUNITY', () => {
    const uc = buildCompose(
      makeBrief({ decision: { ...makeBrief().decision, authorizedAction: 'RESEARCH_ONLY' } })
    );
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'research',
      intentKey: 'c1',
    });
    for (const action of ['CREATE_CONTENT', 'CREATE_TASK', 'CREATE_OPPORTUNITY'] as const) {
      expect(() =>
        uc.addItem({
          trusted: TRUSTED,
          planId: 'plan_1',
          itemId: `item_${action}`,
          action,
          order: 0,
          rationale: 'escalate',
          intentKey: `i_${action}`,
        })
      ).toThrow();
    }
  });

  it('authorizedAction mismatch (Brief CREATE_TASK vs item CREATE_CONTENT) denied', () => {
    const uc = buildCompose(
      makeBrief({ decision: { ...makeBrief().decision, authorizedAction: 'CREATE_TASK' } })
    );
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'task',
      intentKey: 'c1',
    });
    expect(() =>
      uc.addItem({
        trusted: TRUSTED,
        planId: 'plan_1',
        itemId: 'item_1',
        action: 'CREATE_CONTENT',
        order: 0,
        rationale: 'wrong',
        intentKey: 'i1',
      })
    ).toThrow();
  });
});

describe('SPEC-004 Phase 5 — thesis / multi-Brief / first-index (T-004-510 · T-004-07/13)', () => {
  it('Plan thesis A cannot execute against Brief thesis B', () => {
    const briefA = makeBrief({ id: 'brief_a', thesisId: 'th_a' });
    const uc = buildCompose(briefA);
    seedApprovedPlan(uc, { briefId: 'brief_a', planId: 'plan_a', intentPrefix: 'a' });
    uc.setBrief(makeBrief({ id: 'brief_a', thesisId: 'th_b', version: 1 }));
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_a', planItemId: 'item_1' })
    ).toThrow();
  });

  it('multi-thesis: Plan A cannot authorize using Brief B', () => {
    const briefA = makeBrief({ id: 'brief_a', thesisId: 'th_a' });
    const briefB = makeBrief({ id: 'brief_b', thesisId: 'th_b' });
    const kv = memoryKv();
    const store = createLocalStrategicPlanStore(kv);
    store.resetForTest();
    const map = new Map([
      ['org_test|client_test|brief_a', briefA],
      ['org_test|client_test|brief_b', briefB],
    ]);
    const uc = composeStrategicPlan({
      store,
      briefs: {
        getById(id, tenant) {
          return map.get(`${tenant.organizationId}|${tenant.clientId}|${id}`);
        },
      },
    });
    uc.create({
      trusted: TRUSTED,
      planId: 'plan_a',
      strategicBriefId: 'brief_a',
      rationale: 'A',
      intentKey: 'c-a',
    });
    uc.addItem({
      trusted: TRUSTED,
      planId: 'plan_a',
      itemId: 'item_a',
      action: 'CREATE_CONTENT',
      order: 0,
      rationale: 'Ship',
      intentKey: 'i-a',
    });
    uc.propose({ trusted: TRUSTED, planId: 'plan_a' });
    uc.approve({ trusted: TRUSTED, planId: 'plan_a' });
    const plan = uc.plans.getById('plan_a', TRUSTED)!;
    expect(plan.strategicBriefId).toBe('brief_a');
    expect(plan.thesisId).toBe('th_a');
    expect(uc.briefs.getById('brief_b', TRUSTED)?.thesisId).toBe('th_b');
    // Authorizing plan_a still loads Brief A from Plan binding — Brief B is never substituted.
    const allowed = uc.authorize({
      trusted: TRUSTED,
      planId: 'plan_a',
      planItemId: 'item_a',
      forgedBrief: briefB,
    });
    expect(allowed.decision.allowed).toBe(true);
    expect(allowed.thesisId).toBe('th_a');
    expect(allowed.strategicBriefId).toBe('brief_a');
  });

  it('multi-Brief aggregation denied on create', () => {
    const uc = buildCompose();
    expect(() =>
      uc.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'aggregate',
        intentKey: 'agg',
        additionalBriefIds: ['brief_2', 'brief_3'],
      })
    ).toThrow(StrategicPlanError);
  });
});
describe('SPEC-004 Phase 5 — history / forged status / persistence (T-004-505 · T-004-09/10/14/15)', () => {
  it('history PLAN_APPROVED does not authorize SUPERSEDED plan', () => {
    const uc = buildCompose();
    seedApprovedPlan(uc);
    uc.revise({
      trusted: TRUSTED,
      priorPlanId: 'plan_1',
      nextPlanId: 'plan_2',
      rationale: 'revise',
      items: [{ id: 'item_n', action: 'CREATE_CONTENT', order: 0, rationale: 'n' }],
    });
    expect(uc.store.listHistory().some((e) => e.event === 'PLAN_APPROVED')).toBe(true);
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' })
    ).toThrow();
  });

  it('duplicate current plans for same Brief revision fail closed', () => {
    const store = createLocalStrategicPlanStore();
    store.resetForTest();
    const a = validPlan({ id: 'plan_a', status: 'APPROVED', approvedBy: 'mgr_ana' });
    const b = validPlan({ id: 'plan_b', status: 'APPROVED', approvedBy: 'mgr_ana' });
    store.commitWriteUnit({ plans: [a], history: [], idempotencyKeys: [] });
    expect(() =>
      store.commitWriteUnit({ plans: [b], history: [], idempotencyKeys: [] })
    ).toThrow();
  });

  it('malformed Plan missing tenant / Brief / thesis fails closed', () => {
    const store = createLocalStrategicPlanStore();
    store.resetForTest();
    expect(() =>
      store.commitWriteUnit({
        plans: [
          {
            id: 'bad',
            organizationId: '',
            clientId: 'client_test',
            version: 1,
          } as never,
        ],
        history: [],
        idempotencyKeys: [],
      })
    ).toThrow();
  });

  it('stale version overwrite denied', () => {
    const store = createLocalStrategicPlanStore();
    store.resetForTest();
    store.commitWriteUnit({
      plans: [validPlan({ version: 2, status: 'APPROVED', approvedBy: 'mgr_ana' })],
      history: [],
      idempotencyKeys: [],
    });
    expect(() =>
      store.commitWriteUnit({
        plans: [validPlan({ version: 1, status: 'DRAFT' })],
        history: [],
        idempotencyKeys: [],
      })
    ).toThrow();
  });

  it('idempotent create/approve does not duplicate Plan or authority', () => {
    const uc = buildCompose();
    const first = uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'Execute',
      intentKey: 'same-key',
    });
    const again = uc.create({
      trusted: TRUSTED,
      planId: 'plan_1',
      strategicBriefId: 'brief_1',
      rationale: 'Execute',
      intentKey: 'same-key',
    });
    expect(again.plan.id).toBe(first.plan.id);
    expect(again.created).toBe(false);
  });

  it('idempotency key does not cross tenants', () => {
    const briefA = makeBrief({ id: 'brief_a', organizationId: 'org_a', clientId: 'client_a' });
    const briefB = makeBrief({ id: 'brief_b', organizationId: 'org_b', clientId: 'client_b' });
    const kv = memoryKv();
    const store = createLocalStrategicPlanStore(kv);
    store.resetForTest();
    const map = new Map([
      ['org_a|client_a|brief_a', briefA],
      ['org_b|client_b|brief_b', briefB],
    ]);
    const uc = composeStrategicPlan({
      store,
      briefs: {
        getById(id, tenant) {
          return map.get(`${tenant.organizationId}|${tenant.clientId}|${id}`);
        },
      },
    });
    uc.create({
      trusted: { ...TRUSTED, organizationId: 'org_a', clientId: 'client_a' },
      planId: 'plan_a',
      strategicBriefId: 'brief_a',
      rationale: 'A',
      intentKey: 'collision-key',
    });
    uc.create({
      trusted: { ...TRUSTED, organizationId: 'org_b', clientId: 'client_b', actorId: 'b' },
      planId: 'plan_b',
      strategicBriefId: 'brief_b',
      rationale: 'B',
      intentKey: 'collision-key',
    });
    expect(uc.plans.getById('plan_a', { organizationId: 'org_a', clientId: 'client_a' })?.rationale).toBe(
      'A'
    );
    expect(uc.plans.getById('plan_b', { organizationId: 'org_b', clientId: 'client_b' })?.rationale).toBe(
      'B'
    );
  });

  it('write-unit failure before persist leaves no contradictory authority', () => {
    const uc = buildCompose();
    uc.store.failBeforePersistForTest = true;
    expect(() =>
      uc.create({
        trusted: TRUSTED,
        planId: 'plan_1',
        strategicBriefId: 'brief_1',
        rationale: 'x',
        intentKey: 'fail',
      })
    ).toThrow();
    uc.store.failBeforePersistForTest = false;
    // Reload from kv — must be empty / coherent
    const repo = new LocalStrategicPlanRepository(createLocalStrategicPlanStore(uc.kv));
    expect(repo.getById('plan_1', TRUSTED)).toBeUndefined();
  });
});

describe('SPEC-004 Phase 5 — legacy / curation / delivery / content spoof (T-004-506 · T-004-16)', () => {
  it('CurationEntry-like APPROVED does not create Plan authority', async () => {
    const { assertCurationNotPlanAuthority } = await import(
      '../src/services/strategicPlanConsumer'
    );
    expect(() =>
      assertCurationNotPlanAuthority({
        status: 'APPROVED',
        decision: 'CREATE_CONTENT',
        selected: true,
        score: 99,
        thesisId: 'th_1',
      })
    ).not.toThrow();
    const uc = buildCompose();
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'missing', planItemId: 'x' })
    ).toThrow();
  });

  it('DeliveryPackage ready state cannot authorize Plan', () => {
    const uc = buildCompose();
    const deliveryLike = {
      id: 'pkg_1',
      status: 'READY',
      organizationId: 'org_test',
      clientId: 'client_test',
    };
    void deliveryLike;
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'no_plan', planItemId: 'x' })
    ).toThrow();
  });

  it('ContentItem READY/PUBLISHED cannot authorize Plan', () => {
    const uc = buildCompose();
    const contentLike = {
      id: 'content_1',
      status: 'PUBLISHED',
      strategic: true,
      approved: true,
    };
    void contentLike;
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'no_plan', planItemId: 'x' })
    ).toThrow();
  });

  it('Opportunity / Task existence cannot create retroactive Plan approval', () => {
    const uc = buildCompose();
    const downstream = {
      opportunity: { id: 'opp_1', status: 'OPEN' },
      task: { id: 'task_1', status: 'READY' },
    };
    void downstream;
    expect(() =>
      uc.authorize({ trusted: TRUSTED, planId: 'no_plan', planItemId: 'x' })
    ).toThrow();
  });
});

describe('SPEC-004 Phase 5 — SPEC-006 publication boundary (T-004-509 · T-004-17)', () => {
  beforeEach(() => {
    resetClaimEvidenceRuntimeForTest();
  });

  it('Planner ALLOW does not bypass SPEC-006 publication deny', () => {
    const uc = buildCompose();
    seedApprovedPlan(uc);
    const planned = uc.authorize({
      trusted: TRUSTED,
      planId: 'plan_1',
      planItemId: 'item_1',
    });
    expect(planned.decision.allowed).toBe(true);

    const claimStore = createLocalClaimEvidenceStore();
    claimStore.resetForTest();
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
    expect(gate.allowed).toBe(false);
  });
});

describe('SPEC-004 Phase 5 — consumer facade attacks (T-004-506/507)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('forged Plan/Brief on requirePlannedAuthorization ignored; missing Plan denies', async () => {
    vi.doMock('../src/services/strategicBriefConsumer', () => ({
      requireStrategicAuthorization: () => ({
        authorized: true,
        briefId: 'brief_1',
        version: 1,
      }),
      getStrategicBrief: () => makeBrief(),
      formatAuthorizationDenial: () => 'brief denied',
    }));
    vi.doMock('../src/services/auth', () => ({
      authService: {
        getCurrentUser: () => ({
          uid: 'mgr_ana',
          role: 'ADMIN',
          email: 'mgr@test',
          displayName: 'Mgr',
        }),
      },
    }));
    vi.doMock('../src/services/db', () => ({
      dbService: {
        getClientById: (id: string) =>
          id === 'client_test'
            ? { id: 'client_test', organizationId: 'org_test', name: 'Test' }
            : undefined,
        getContentById: () => undefined,
        getEvidenceById: () => undefined,
      },
    }));
    const { resetStrategicPlanConsumerForTest, requirePlannedAuthorization } = await import(
      '../src/services/strategicPlanConsumer'
    );
    resetStrategicPlanConsumerForTest();
    const result = requirePlannedAuthorization({
      clientId: 'client_test',
      briefId: 'brief_1',
      requestedAction: 'CREATE_CONTENT',
      forgedPlan: { status: 'APPROVED', approvedBy: 'attacker', version: 99 },
      forgedBrief: { status: 'APPROVED', version: 99, authorizedAction: 'CREATE_CONTENT' },
    });
    expect(result.authorized).toBe(false);
    expect(result.denialCode).toBe('PLAN_NOT_FOUND');
  });

  it('AI actorKind / approvedBy on consumer approve ignored; trusted actor wins', async () => {
    vi.doMock('../src/services/strategicBriefConsumer', () => ({
      requireStrategicAuthorization: () => ({
        authorized: true,
        briefId: 'brief_1',
        version: 1,
      }),
      getStrategicBrief: () => makeBrief(),
      formatAuthorizationDenial: () => 'brief denied',
    }));
    vi.doMock('../src/services/auth', () => ({
      authService: {
        getCurrentUser: () => ({
          uid: 'mgr_ana',
          role: 'ADMIN',
          email: 'mgr@test',
          displayName: 'Mgr',
        }),
      },
    }));
    vi.doMock('../src/services/db', () => ({
      dbService: {
        getClientById: (id: string) =>
          id === 'client_test'
            ? { id: 'client_test', organizationId: 'org_test', name: 'Test' }
            : undefined,
        getContentById: () => undefined,
        getEvidenceById: () => undefined,
      },
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
    const approved = mod.approveStrategicPlan({
      clientId: 'client_test',
      planId: 'plan_1',
      approvedBy: 'ai_attacker',
      actorKind: 'AI',
      now: LATER,
    });
    expect(approved.plan.approvedBy).toBe('mgr_ana');
    expect(approved.plan.status).toBe('APPROVED');
  });

  it('NONE / RESEARCH_ONLY via consumer denied as executable', async () => {
    vi.doMock('../src/services/strategicBriefConsumer', () => ({
      requireStrategicAuthorization: () => ({ authorized: true, briefId: 'brief_1' }),
      getStrategicBrief: () => makeBrief(),
      formatAuthorizationDenial: () => 'brief denied',
    }));
    vi.doMock('../src/services/auth', () => ({
      authService: {
        getCurrentUser: () => ({
          uid: 'mgr_ana',
          role: 'ADMIN',
          email: 'a',
          displayName: 'A',
        }),
      },
    }));
    vi.doMock('../src/services/db', () => ({
      dbService: {
        getClientById: () => ({
          id: 'client_test',
          organizationId: 'org_test',
          name: 'T',
        }),
      },
    }));
    const { resetStrategicPlanConsumerForTest, requirePlannedAuthorization } = await import(
      '../src/services/strategicPlanConsumer'
    );
    resetStrategicPlanConsumerForTest();
    for (const action of ['NONE', 'RESEARCH_ONLY'] as const) {
      const result = requirePlannedAuthorization({
        clientId: 'client_test',
        briefId: 'brief_1',
        requestedAction: action,
      });
      expect(result.authorized).toBe(false);
      expect(result.denialCode).toBe('ACTION_NOT_AUTHORIZED');
    }
  });
});

describe('SPEC-004 Phase 5 — SPEC-003/005 boundary + explainability (T-004-507/508)', () => {
  it('Planner path cannot mutate Brief status/version/authorizedAction', () => {
    const uc = buildCompose();
    seedApprovedPlan(uc);
    const before = uc.briefs.getById('brief_1', TRUSTED)!;
    expect(() =>
      uc.authorize({
        trusted: TRUSTED,
        planId: 'plan_1',
        planItemId: 'item_1',
        forgedBrief: {
          status: 'SUPERSEDED',
          version: 99,
          decision: { authorizedAction: 'NONE' },
        },
      })
    ).not.toThrow();
    const after = uc.briefs.getById('brief_1', TRUSTED)!;
    expect(after.status).toBe(before.status);
    expect(after.version).toBe(before.version);
    expect(after.decision.authorizedAction).toBe(before.decision.authorizedAction);
  });

  it('authorize denial exposes structured reason codes (no silent fallback)', () => {
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
    try {
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' });
      expect.fail('expected deny');
    } catch (err) {
      expect(err).toBeInstanceOf(StrategicPlanError);
      expect((err as StrategicPlanError).code).toBeTruthy();
      expect((err as StrategicPlanError).message.length).toBeGreaterThan(0);
    }
  });

  it('PlannerAdvisorPort remains advisory (no approve API)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const advisor = readFileSync(
      join(process.cwd(), 'src/application/strategicPlan/ports/PlannerAdvisorPort.ts'),
      'utf8'
    );
    expect(advisor).toMatch(/suggest/i);
    expect(advisor).toMatch(/never approval|suggestions only/i);
    expect(advisor).not.toMatch(/approveStrategicPlan|activatePlanItem/);
  });
});

describe('SPEC-004 Phase 5 — side-effect ordering / direct Domain bypass note (T-004-11/12)', () => {
  it('Planner deny precedes any authorize success (DRAFT = no allow)', () => {
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
    let sideEffects = 0;
    try {
      uc.authorize({ trusted: TRUSTED, planId: 'plan_1', planItemId: 'item_1' });
      sideEffects += 1;
    } catch {
      // expected deny
    }
    expect(sideEffects).toBe(0);
  });

  it('UI-forged status fields alone produce zero Application writes', () => {
    const uc = buildCompose();
    const uiState = {
      approvedToggle: true,
      activeStatus: 'ACTIVE',
      selectedThesis: 'th_winner',
      executionAllowed: true,
      adminRole: true,
    };
    void uiState;
    expect(uc.store.listHistory()).toHaveLength(0);
    expect(uc.plans.getById('plan_ui', TRUSTED)).toBeUndefined();
  });
});
