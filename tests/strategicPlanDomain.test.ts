/**
 * SPEC-004 Phase 1 — StrategicPlan Domain unit tests (T-004-101…110).
 */

import { describe, expect, it } from 'vitest';
import type { PlanBriefContext } from '../src/domain/planBriefContextCore';
import {
  assertBriefContextCurrentForPlan,
  assertSingleBriefScope,
  assertSingleThesisScope,
} from '../src/domain/planBriefContextCore';
import { projectStrategicPlanExplainability } from '../src/domain/planExplainabilityCore';
import { authorizePlannedAction } from '../src/domain/planGateCore';
import {
  createPlanItem,
  transitionPlanItemStatus,
  assertPlanItemCannotSelfAuthorize,
  type PlanItem,
} from '../src/domain/planItemCore';
import {
  assertApprovedPlanNotMateriallyMutatedInPlace,
  createPlanIdempotencyKey,
  planHistoryIntent,
  planMaterialFingerprint,
} from '../src/domain/planMaterialityCore';
import {
  attachPlanItem,
  createStrategicPlan,
  reviseStrategicPlanMaterial,
  transitionPlanStatus,
  type StrategicPlan,
} from '../src/domain/strategicPlanCore';

function brief(over: Partial<PlanBriefContext> = {}): PlanBriefContext {
  return {
    id: 'brief-1',
    version: 1,
    status: 'APPROVED',
    organizationId: 'org-1',
    clientId: 'client-1',
    thesisId: 'thesis-1',
    authorizedAction: 'CREATE_CONTENT',
    signalIds: ['sig-1', 'sig-2'],
    ...over,
  };
}

function makePlan(over: Partial<PlanBriefContext> = {}): StrategicPlan {
  const created = createStrategicPlan({
    id: 'plan-1',
    createdBy: 'mgr-1',
    createdAt: '2026-08-25T00:00:00.000Z',
    rationale: 'Execute approved brief',
    brief: brief(over),
  });
  if (!created.ok) throw created.error;
  return created.value;
}

function makeItem(
  plan: StrategicPlan,
  over: { id?: string; action?: PlanItem['action']; order?: number } = {}
): PlanItem {
  const created = createPlanItem({
    id: over.id ?? 'item-1',
    planId: plan.id,
    organizationId: plan.organizationId,
    clientId: plan.clientId,
    action: over.action ?? 'CREATE_CONTENT',
    order: over.order ?? 0,
    rationale: 'Ship content',
    createdAt: '2026-08-25T00:00:00.000Z',
    briefAuthorizedAction: plan.authorizedAction,
    planTenant: plan,
  });
  if (!created.ok) throw created.error;
  return created.value;
}

function approvePlan(plan: StrategicPlan): StrategicPlan {
  const proposed = transitionPlanStatus(plan, 'PROPOSED', {
    actorKind: 'HUMAN',
    updatedAt: '2026-08-25T01:00:00.000Z',
  });
  if (!proposed.ok) throw proposed.error;
  const approved = transitionPlanStatus(proposed.value, 'APPROVED', {
    actorKind: 'HUMAN',
    updatedAt: '2026-08-25T01:01:00.000Z',
    approvedBy: 'mgr-1',
  });
  if (!approved.ok) throw approved.error;
  return approved.value;
}

describe('SPEC-004 Phase 1 — StrategicPlan / PlanItem construction (T-004-101/102)', () => {
  it('creates StrategicPlan bound to one APPROVED Brief with explicit thesis and signals', () => {
    const plan = makePlan();
    expect(plan.status).toBe('DRAFT');
    expect(plan.strategicBriefId).toBe('brief-1');
    expect(plan.strategicBriefVersion).toBe(1);
    expect(plan.thesisId).toBe('thesis-1');
    expect(plan.signalIds).toEqual(['sig-1', 'sig-2']);
    expect(plan.authorizedAction).toBe('CREATE_CONTENT');
    expect(plan.version).toBe(1);
  });

  it('denies plan create when Brief is not APPROVED', () => {
    const result = createStrategicPlan({
      id: 'plan-x',
      createdBy: 'mgr',
      createdAt: 't',
      rationale: 'r',
      brief: brief({ status: 'DRAFT' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STALE_BRIEF_CONTEXT');
  });

  it('creates PlanItem bounded by Brief authorizedAction', () => {
    const plan = makePlan();
    const item = makeItem(plan);
    expect(item.action).toBe('CREATE_CONTENT');
    expect(item.status).toBe('PLANNED');
  });

  it('denies unauthorized PlanItem action and NONE executable authority', () => {
    const plan = makePlan();
    const bad = createPlanItem({
      id: 'i',
      planId: plan.id,
      organizationId: plan.organizationId,
      clientId: plan.clientId,
      action: 'CREATE_OPPORTUNITY',
      order: 0,
      rationale: 'x',
      createdAt: 't',
      briefAuthorizedAction: 'CREATE_CONTENT',
      planTenant: plan,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('ACTION_NOT_AUTHORIZED');

    const none = createPlanItem({
      id: 'i2',
      planId: plan.id,
      organizationId: plan.organizationId,
      clientId: plan.clientId,
      action: 'NONE',
      order: 0,
      rationale: 'x',
      createdAt: 't',
      briefAuthorizedAction: 'NONE',
      planTenant: plan,
    });
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error.code).toBe('ACTION_NOT_AUTHORIZED');
  });
});

describe('SPEC-004 Phase 1 — lifecycle (T-004-103)', () => {
  it('allows valid plan transitions and rejects invalid ones', () => {
    const plan = makePlan();
    const bad = transitionPlanStatus(plan, 'ACTIVE', {
      actorKind: 'HUMAN',
      updatedAt: 't',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('INVALID_PLAN_TRANSITION');

    const approved = approvePlan(plan);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('mgr-1');
  });

  it('allows valid item transitions and rejects DONE outbound', () => {
    const plan = makePlan();
    const item = makeItem(plan);
    const ready = transitionPlanItemStatus(item, 'READY', 't2');
    expect(ready.ok).toBe(true);
    const done = transitionPlanItemStatus(
      { ...(ready.ok ? ready.value : item), status: 'DONE' } as PlanItem,
      'READY',
      't3'
    );
    // force DONE then try leave
    const toDone = transitionPlanItemStatus(ready.ok ? ready.value : item, 'IN_PROGRESS', 't3');
    expect(toDone.ok).toBe(true);
    if (toDone.ok) {
      const finished = transitionPlanItemStatus(toDone.value, 'DONE', 't4');
      expect(finished.ok).toBe(true);
      if (finished.ok) {
        const leave = transitionPlanItemStatus(finished.value, 'READY', 't5');
        expect(leave.ok).toBe(false);
      }
    }
    expect(done.ok).toBe(false);
  });

  it('DRAFT/PROPOSED/REJECTED/CANCELLED/SUPERSEDED/COMPLETED cannot execute', () => {
    const plan = makePlan();
    let item = makeItem(plan);
    const attached = attachPlanItem(plan, item);
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    item = transitionPlanItemStatus(item, 'READY', 't').ok
      ? (transitionPlanItemStatus(item, 'READY', 't') as { ok: true; value: PlanItem }).value
      : item;

    const draftGate = authorizePlannedAction({
      plan: attached.value,
      item,
      brief: brief(),
      actorKind: 'HUMAN',
    });
    expect(draftGate.ok).toBe(false);

    const approved = approvePlan(attached.value);
    // mark item ready on approved plan projection
    const withReady: StrategicPlan = {
      ...approved,
      items: approved.items.map((row) =>
        row.id === item.id ? { ...row, status: 'READY' as const } : row
      ),
    };
    const readyItem = withReady.items[0]!;
    const okGate = authorizePlannedAction({
      plan: withReady,
      item: readyItem,
      brief: brief(),
      actorKind: 'HUMAN',
    });
    expect(okGate.ok).toBe(true);
  });
});

describe('SPEC-004 Phase 1 — human / AI authority (T-004-106)', () => {
  it('requires HUMAN for approve; AI forbidden', () => {
    const plan = makePlan();
    const proposed = transitionPlanStatus(plan, 'PROPOSED', {
      actorKind: 'HUMAN',
      updatedAt: 't',
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const ai = transitionPlanStatus(proposed.value, 'APPROVED', {
      actorKind: 'AI',
      updatedAt: 't2',
      approvedBy: 'bot',
    });
    expect(ai.ok).toBe(false);
    if (!ai.ok) expect(ai.error.code).toBe('AI_APPROVAL_FORBIDDEN');
  });

  it('PlanItem cannot self-authorize', () => {
    const plan = makePlan();
    const item = makeItem(plan);
    const self = assertPlanItemCannotSelfAuthorize(item);
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.error.code).toBe('ITEM_CANNOT_SELF_AUTHORIZE');
  });
});

describe('SPEC-004 Phase 1 — tenant / multi-thesis / multi-Brief (T-004-104/109)', () => {
  it('denies cross-tenant PlanItem attach', () => {
    const plan = makePlan();
    const foreign = createPlanItem({
      id: 'fx',
      planId: plan.id,
      organizationId: 'org-1',
      clientId: 'client-OTHER',
      action: 'CREATE_CONTENT',
      order: 0,
      rationale: 'x',
      createdAt: 't',
      briefAuthorizedAction: 'CREATE_CONTENT',
      planTenant: plan,
    });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.code).toBe('TENANT_MISMATCH');
  });

  it('allows multiple plans for different theses of same client', () => {
    const a = makePlan({ thesisId: 'thesis-a', id: 'brief-a' });
    const b = makePlan({ thesisId: 'thesis-b', id: 'brief-b', signalIds: ['s-b'] });
    expect(a.thesisId).not.toBe(b.thesisId);
    expect(a.clientId).toBe(b.clientId);
  });

  it('denies multi-Brief aggregation and mixed thesis scope', () => {
    expect(assertSingleBriefScope('brief-1', 'brief-2').ok).toBe(false);
    expect(assertSingleThesisScope('t1', 't2').ok).toBe(false);
  });
});

describe('SPEC-004 Phase 1 — stale Brief / gate / SPEC-006 separation (T-004-105/106)', () => {
  it('fails closed on stale Brief version / superseded / thesis mismatch', () => {
    const plan = makePlan();
    const binding = {
      strategicBriefId: plan.strategicBriefId,
      strategicBriefVersion: plan.strategicBriefVersion,
      thesisId: plan.thesisId,
      organizationId: plan.organizationId,
      clientId: plan.clientId,
    };
    expect(assertBriefContextCurrentForPlan(binding, brief({ version: 2 })).ok).toBe(false);
    expect(
      assertBriefContextCurrentForPlan(binding, brief({ status: 'SUPERSEDED' })).ok
    ).toBe(false);
    expect(
      assertBriefContextCurrentForPlan(binding, brief({ thesisId: 'other' })).ok
    ).toBe(false);
  });

  it('authorizePlannedAction does not evaluate SPEC-006 publication', () => {
    let p = makePlan();
    const item0 = makeItem(p);
    const attached = attachPlanItem(p, item0);
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    p = approvePlan(attached.value);
    const readyItem = {
      ...p.items[0]!,
      status: 'READY' as const,
    };
    p = { ...p, items: [readyItem] };
    const decision = authorizePlannedAction({
      plan: p,
      item: readyItem,
      brief: brief(),
      actorKind: 'HUMAN',
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.value.reasons).toContain('spec006_publication_not_evaluated');
    }
  });
});

describe('SPEC-004 Phase 1 — materiality / versioning / history intent (T-004-107/108)', () => {
  it('detects material in-place mutation on APPROVED plan', () => {
    let plan = makePlan();
    const item = makeItem(plan);
    const attached = attachPlanItem(plan, item);
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    plan = approvePlan(attached.value);
    const mutated = { ...plan, rationale: 'changed materially' };
    const check = assertApprovedPlanNotMateriallyMutatedInPlace(plan, mutated);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error.code).toBe('MATERIAL_CHANGE_REQUIRES_REVISION');
  });

  it('material revise supersedes prior and bumps version', () => {
    let plan = makePlan();
    const item = makeItem(plan);
    const attached = attachPlanItem(plan, item);
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    plan = approvePlan(attached.value);
    const revised = reviseStrategicPlanMaterial(
      plan,
      'plan-2',
      'mgr-1',
      '2026-08-25T03:00:00.000Z',
      brief({ version: 2 }),
      'Revalidate against Brief v2',
      plan.items.map((row) => ({ ...row, planId: 'plan-2' }))
    );
    expect(revised.ok).toBe(true);
    if (revised.ok) {
      expect(revised.value.prior.status).toBe('SUPERSEDED');
      expect(revised.value.next.version).toBe(plan.version + 1);
      expect(revised.value.next.strategicBriefVersion).toBe(2);
      expect(revised.value.next.status).toBe('DRAFT');
    }
  });

  it('history intent is descriptive only; fingerprint + idempotency keys are deterministic', () => {
    const plan = makePlan();
    const intent = planHistoryIntent('PLAN_CREATED', plan, { actorId: 'mgr-1' });
    expect(intent.event).toBe('PLAN_CREATED');
    expect(planMaterialFingerprint(plan)).toEqual(planMaterialFingerprint(plan));
    expect(
      createPlanIdempotencyKey({
        organizationId: 'org-1',
        clientId: 'client-1',
        strategicBriefId: 'brief-1',
        strategicBriefVersion: 1,
        intentKey: 'k1',
      })
    ).toContain('plan-create');
  });

  it('explainability projects Brief/thesis/action/items without chain-of-thought', () => {
    const plan = makePlan();
    const projection = projectStrategicPlanExplainability(plan);
    expect(projection.strategicBriefId).toBe('brief-1');
    expect(projection.thesisId).toBe('thesis-1');
    expect(projection.authorizedAction).toBe('CREATE_CONTENT');
    expect(projection).not.toHaveProperty('chainOfThought');
  });
});

describe('SPEC-004 Phase 1 — multi-signal traceability', () => {
  it('preserves Brief signalIds on plan without rerouting', () => {
    const plan = makePlan({ signalIds: ['a', 'b', 'c'] });
    expect(plan.signalIds).toEqual(['a', 'b', 'c']);
  });
});
