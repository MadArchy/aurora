/**
 * SPEC-004 Phase 1 — Domain error model (pure).
 */

export type StrategicPlanDomainErrorCode =
  | 'INVALID_PLAN'
  | 'INVALID_PLAN_ITEM'
  | 'INVALID_PLAN_TRANSITION'
  | 'INVALID_ITEM_TRANSITION'
  | 'TENANT_MISMATCH'
  | 'BRIEF_SCOPE_MISMATCH'
  | 'THESIS_MISMATCH'
  | 'ACTION_NOT_AUTHORIZED'
  | 'PLAN_SUPERSEDED'
  | 'PLAN_NOT_APPROVED'
  | 'STALE_BRIEF_CONTEXT'
  | 'MATERIAL_CHANGE_REQUIRES_REVISION'
  | 'AI_APPROVAL_FORBIDDEN'
  | 'MULTI_BRIEF_AGGREGATION_DENIED'
  | 'ITEM_CANNOT_SELF_AUTHORIZE';

export class StrategicPlanDomainError extends Error {
  readonly code: StrategicPlanDomainErrorCode;

  constructor(code: StrategicPlanDomainErrorCode, message: string) {
    super(message);
    this.name = 'StrategicPlanDomainError';
    this.code = code;
  }
}

export type PlanDomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StrategicPlanDomainError };

export function planOk<T>(value: T): PlanDomainResult<T> {
  return { ok: true, value };
}

export function planFail(
  code: StrategicPlanDomainErrorCode,
  message: string
): PlanDomainResult<never> {
  return { ok: false, error: new StrategicPlanDomainError(code, message) };
}
