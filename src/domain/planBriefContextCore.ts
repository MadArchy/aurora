/**
 * SPEC-004 Phase 1 — Brief context projection + stale Brief fail-closed (pure).
 * Domain receives a supplied projection; it does not load SPEC-003 repositories.
 */

import type { StrategicAuthorizedAction } from './strategicBriefCore';
import { isStrategicAuthorizedAction } from './strategicBriefCore';
import { planFail, planOk, type PlanDomainResult } from './strategicPlanErrors';
import {
  assertPlanTenantStructure,
  assertPlanTenantsMatch,
  type PlanTenantEnvelope,
} from './planTenantCore';

export const PLAN_BRIEF_STATUSES = ['DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const;
export type PlanBriefStatus = (typeof PLAN_BRIEF_STATUSES)[number];

/** Pure Brief snapshot for planner Domain predicates (not a repository load). */
export interface PlanBriefContext {
  id: string;
  version: number;
  status: PlanBriefStatus;
  organizationId: string;
  clientId: string;
  thesisId: string;
  authorizedAction: StrategicAuthorizedAction;
  signalIds: readonly string[];
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function assertPlanBriefContext(
  brief: PlanBriefContext
): PlanDomainResult<PlanBriefContext> {
  const id = nonEmpty(brief.id);
  const thesisId = nonEmpty(brief.thesisId);
  if (!id || !thesisId) {
    return planFail('INVALID_PLAN', 'Brief context id and thesisId are required');
  }
  if (!Number.isInteger(brief.version) || brief.version < 1) {
    return planFail('INVALID_PLAN', 'Brief version must be integer >= 1');
  }
  if (!(PLAN_BRIEF_STATUSES as readonly string[]).includes(brief.status)) {
    return planFail('INVALID_PLAN', 'Brief status is invalid');
  }
  if (!isStrategicAuthorizedAction(brief.authorizedAction)) {
    return planFail('INVALID_PLAN', 'Brief authorizedAction is invalid');
  }
  const tenant = assertPlanTenantStructure(brief);
  if (!tenant.ok) return tenant;
  if (!Array.isArray(brief.signalIds)) {
    return planFail('INVALID_PLAN', 'Brief signalIds must be an array');
  }
  return planOk({
    id,
    version: brief.version,
    status: brief.status,
    organizationId: tenant.value.organizationId,
    clientId: tenant.value.clientId,
    thesisId,
    authorizedAction: brief.authorizedAction,
    signalIds: [...brief.signalIds],
  });
}

export interface PlanBriefBinding {
  strategicBriefId: string;
  strategicBriefVersion: number;
  thesisId: string;
  organizationId: string;
  clientId: string;
}

/**
 * Fail-closed stale / superseded / mismatch checks when Brief projection is supplied.
 */
export function assertBriefContextCurrentForPlan(
  binding: PlanBriefBinding,
  brief: PlanBriefContext
): PlanDomainResult<PlanBriefContext> {
  const validated = assertPlanBriefContext(brief);
  if (!validated.ok) return validated;
  const b = validated.value;

  if (b.id !== binding.strategicBriefId) {
    return planFail('BRIEF_SCOPE_MISMATCH', 'Brief id does not match plan binding');
  }
  if (b.version !== binding.strategicBriefVersion) {
    return planFail('STALE_BRIEF_CONTEXT', 'Brief version does not match plan binding');
  }
  if (b.status === 'SUPERSEDED') {
    return planFail('STALE_BRIEF_CONTEXT', 'Brief is SUPERSEDED');
  }
  if (b.status !== 'APPROVED') {
    return planFail('STALE_BRIEF_CONTEXT', `Brief status=${b.status} is not APPROVED`);
  }
  if (b.thesisId !== binding.thesisId) {
    return planFail('THESIS_MISMATCH', 'Brief thesisId does not match plan thesisId');
  }
  const tenant = assertPlanTenantsMatch(binding, b);
  if (!tenant.ok) return tenant;
  return planOk(b);
}

export function isActionAllowedByBrief(
  briefAction: StrategicAuthorizedAction,
  itemAction: StrategicAuthorizedAction
): boolean {
  if (briefAction === 'NONE') return false;
  return briefAction === itemAction;
}

export function assertActionAllowedByBrief(
  briefAction: StrategicAuthorizedAction,
  itemAction: StrategicAuthorizedAction
): PlanDomainResult<void> {
  if (!isActionAllowedByBrief(briefAction, itemAction)) {
    return planFail(
      'ACTION_NOT_AUTHORIZED',
      `PlanItem action ${itemAction} is not authorized by Brief action ${briefAction}`
    );
  }
  return planOk(undefined);
}

/** Multi-Brief aggregation into one plan scope is denied. */
export function assertSingleBriefScope(
  planBriefId: string,
  otherBriefId: string
): PlanDomainResult<void> {
  if (planBriefId !== otherBriefId) {
    return planFail(
      'MULTI_BRIEF_AGGREGATION_DENIED',
      'one StrategicPlan may bind only one Strategic Brief revision'
    );
  }
  return planOk(undefined);
}

export function assertSingleThesisScope(
  planThesisId: string,
  otherThesisId: string
): PlanDomainResult<void> {
  if (planThesisId !== otherThesisId) {
    return planFail('THESIS_MISMATCH', 'one StrategicPlan may bind only one thesis');
  }
  return planOk(undefined);
}

export type { PlanTenantEnvelope };
