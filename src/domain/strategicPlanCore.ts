/**
 * SPEC-004 Phase 1 — StrategicPlan aggregate + PlanStatus lifecycle (pure).
 */

import type { StrategicAuthorizedAction } from './strategicBriefCore';
import {
  assertPlanBriefContext,
  assertSingleBriefScope,
  assertSingleThesisScope,
  type PlanBriefContext,
} from './planBriefContextCore';
import type { PlanActorKind, PlanItem } from './planItemCore';
import { planFail, planOk, type PlanDomainResult } from './strategicPlanErrors';
import {
  assertPlanTenantsMatch,
  type PlanTenantEnvelope,
} from './planTenantCore';

export const STRATEGIC_PLAN_SCHEMA_VERSION = 'strategic-plan-v1' as const;

export const PLAN_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'APPROVED',
  'ACTIVE',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'SUPERSEDED',
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  DRAFT: ['PROPOSED', 'CANCELLED'],
  PROPOSED: ['APPROVED', 'REJECTED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'CANCELLED', 'SUPERSEDED'],
  ACTIVE: ['COMPLETED', 'CANCELLED', 'SUPERSEDED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  SUPERSEDED: [],
};

/** Statuses that may authorize new item activations when Brief is valid. */
export const PLAN_EXECUTION_ELIGIBLE_STATUSES: readonly PlanStatus[] = ['APPROVED', 'ACTIVE'];

export interface PlanAiAdvisoryRef {
  operation?: string;
  aiRunId?: string;
  note?: string;
}

export interface StrategicPlan {
  id: string;
  organizationId: string;
  clientId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  thesisId: string;
  signalIds: string[];
  /** Brief authorizedAction captured at binding (upper bound). */
  authorizedAction: StrategicAuthorizedAction;
  status: PlanStatus;
  version: number;
  schemaVersion: typeof STRATEGIC_PLAN_SCHEMA_VERSION;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  rationale: string;
  priorityBand: string | null;
  aiAdvisoryRefs: PlanAiAdvisoryRef[];
  supersededByPlanId: string | null;
  supersedesPlanId: string | null;
  items: PlanItem[];
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === 'string' && (PLAN_STATUSES as readonly string[]).includes(value);
}

export function canTransitionPlanStatus(from: PlanStatus, to: PlanStatus): boolean {
  return PLAN_STATUS_TRANSITIONS[from].includes(to);
}

export function assertActorMayApprove(actorKind: PlanActorKind): PlanDomainResult<void> {
  if (actorKind === 'AI') {
    return planFail('AI_APPROVAL_FORBIDDEN', 'AI cannot approve, reject, or activate plans');
  }
  if (actorKind !== 'HUMAN') {
    return planFail('PLAN_NOT_APPROVED', 'plan approve/reject requires HUMAN actor');
  }
  return planOk(undefined);
}

export function assertActorMayActivate(actorKind: PlanActorKind): PlanDomainResult<void> {
  if (actorKind === 'AI') {
    return planFail('AI_APPROVAL_FORBIDDEN', 'AI cannot activate plan items');
  }
  if (actorKind !== 'HUMAN' && actorKind !== 'SOFTWARE') {
    return planFail('PLAN_NOT_APPROVED', 'activation requires HUMAN or SOFTWARE actor');
  }
  return planOk(undefined);
}

export interface CreateStrategicPlanInput {
  id: string;
  createdBy: string;
  createdAt: string;
  rationale: string;
  brief: PlanBriefContext;
  priorityBand?: string | null;
  aiAdvisoryRefs?: PlanAiAdvisoryRef[];
  supersedesPlanId?: string | null;
}

/**
 * Create DRAFT plan bound to one APPROVED Brief revision.
 * Domain does not load Brief — caller supplies validated projection.
 */
export function createStrategicPlan(
  input: CreateStrategicPlanInput
): PlanDomainResult<StrategicPlan> {
  const id = nonEmpty(input.id);
  const createdBy = nonEmpty(input.createdBy);
  const rationale = nonEmpty(input.rationale);
  if (!id || !createdBy || !rationale) {
    return planFail('INVALID_PLAN', 'id, createdBy, and rationale are required');
  }

  const brief = assertPlanBriefContext(input.brief);
  if (!brief.ok) return brief;
  if (brief.value.status !== 'APPROVED') {
    return planFail(
      'STALE_BRIEF_CONTEXT',
      'StrategicPlan may only be created against an APPROVED Brief'
    );
  }
  if (brief.value.authorizedAction === 'NONE') {
    // Plan may exist as empty DRAFT documentation, but no executable items can be added.
    // Creation itself is allowed so governance can record NONE explicitly if needed.
  }

  return planOk({
    id,
    organizationId: brief.value.organizationId,
    clientId: brief.value.clientId,
    strategicBriefId: brief.value.id,
    strategicBriefVersion: brief.value.version,
    thesisId: brief.value.thesisId,
    signalIds: [...brief.value.signalIds],
    authorizedAction: brief.value.authorizedAction,
    status: 'DRAFT',
    version: 1,
    schemaVersion: STRATEGIC_PLAN_SCHEMA_VERSION,
    createdBy,
    approvedBy: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    rationale,
    priorityBand: input.priorityBand?.trim() ? input.priorityBand.trim() : null,
    aiAdvisoryRefs: input.aiAdvisoryRefs ? [...input.aiAdvisoryRefs] : [],
    supersededByPlanId: null,
    supersedesPlanId: input.supersedesPlanId ?? null,
    items: [],
  });
}

export function transitionPlanStatus(
  plan: StrategicPlan,
  to: PlanStatus,
  opts: {
    actorKind: PlanActorKind;
    updatedAt: string;
    approvedBy?: string | null;
  }
): PlanDomainResult<StrategicPlan> {
  if (!canTransitionPlanStatus(plan.status, to)) {
    return planFail(
      'INVALID_PLAN_TRANSITION',
      `StrategicPlan cannot transition ${plan.status} → ${to}`
    );
  }

  if (to === 'APPROVED' || to === 'REJECTED') {
    const actor = assertActorMayApprove(opts.actorKind);
    if (!actor.ok) return actor;
  }
  if (to === 'ACTIVE') {
    const actor = assertActorMayActivate(opts.actorKind);
    if (!actor.ok) return actor;
    if (plan.status !== 'APPROVED') {
      return planFail('PLAN_NOT_APPROVED', 'plan must be APPROVED before ACTIVE');
    }
  }

  let approvedBy = plan.approvedBy;
  if (to === 'APPROVED') {
    const by = nonEmpty(opts.approvedBy ?? null);
    if (!by) {
      return planFail('PLAN_NOT_APPROVED', 'approvedBy is required when approving');
    }
    approvedBy = by;
  }

  return planOk({
    ...plan,
    status: to,
    approvedBy,
    updatedAt: opts.updatedAt,
  });
}

export function attachPlanItem(
  plan: StrategicPlan,
  item: PlanItem
): PlanDomainResult<StrategicPlan> {
  if (plan.status !== 'DRAFT' && plan.status !== 'PROPOSED') {
    return planFail(
      'MATERIAL_CHANGE_REQUIRES_REVISION',
      'cannot mutate items on APPROVED/ACTIVE plan in place'
    );
  }
  const tenant = assertPlanTenantsMatch(plan, item);
  if (!tenant.ok) return tenant;
  if (item.planId !== plan.id) {
    return planFail('INVALID_PLAN_ITEM', 'PlanItem.planId must match StrategicPlan.id');
  }
  if (plan.items.some((row) => row.id === item.id)) {
    return planFail('INVALID_PLAN_ITEM', 'duplicate PlanItem id');
  }
  return planOk({
    ...plan,
    items: [...plan.items, item],
    updatedAt: item.updatedAt,
  });
}

export function removePlanItem(
  plan: StrategicPlan,
  itemId: string,
  updatedAt: string
): PlanDomainResult<StrategicPlan> {
  if (plan.status !== 'DRAFT' && plan.status !== 'PROPOSED') {
    return planFail(
      'MATERIAL_CHANGE_REQUIRES_REVISION',
      'cannot remove items on APPROVED/ACTIVE plan in place'
    );
  }
  if (!plan.items.some((row) => row.id === itemId)) {
    return planFail('INVALID_PLAN_ITEM', 'PlanItem not found on plan');
  }
  return planOk({
    ...plan,
    items: plan.items.filter((row) => row.id !== itemId),
    updatedAt,
  });
}

/**
 * Material revise: produce new DRAFT revision and mark prior SUPERSEDED (caller persists both).
 */
export function reviseStrategicPlanMaterial(
  prior: StrategicPlan,
  nextId: string,
  createdBy: string,
  createdAt: string,
  brief: PlanBriefContext,
  rationale: string,
  items: PlanItem[]
): PlanDomainResult<{ prior: StrategicPlan; next: StrategicPlan }> {
  if (prior.status !== 'APPROVED' && prior.status !== 'ACTIVE') {
    return planFail(
      'MATERIAL_CHANGE_REQUIRES_REVISION',
      'material revise applies to APPROVED/ACTIVE plans'
    );
  }
  const created = createStrategicPlan({
    id: nextId,
    createdBy,
    createdAt,
    rationale,
    brief,
    supersedesPlanId: prior.id,
  });
  if (!created.ok) return created;

  // Preserve single-brief / single-thesis: createStrategicPlan already binds brief.
  const briefScope = assertSingleBriefScope(prior.strategicBriefId, brief.id);
  if (!briefScope.ok) {
    // Allow rebind only when revising against a newer version of same Brief id, or same id.
    // Different Brief id = multi-Brief aggregation deny.
    return briefScope;
  }
  const thesisScope = assertSingleThesisScope(prior.thesisId, brief.thesisId);
  if (!thesisScope.ok) return thesisScope;

  let next = created.value;
  next = { ...next, version: prior.version + 1, items: [] };
  for (const item of items) {
    const attached = attachPlanItem(next, { ...item, planId: next.id });
    if (!attached.ok) return attached;
    next = attached.value;
  }

  const priorSuperseded: StrategicPlan = {
    ...prior,
    status: 'SUPERSEDED',
    supersededByPlanId: next.id,
    updatedAt: createdAt,
  };

  return planOk({ prior: priorSuperseded, next });
}

export function assertPlanTenantConsistency(
  plan: StrategicPlan,
  other: PlanTenantEnvelope
): PlanDomainResult<void> {
  return assertPlanTenantsMatch(plan, other);
}

export type { PlanTenantEnvelope };
