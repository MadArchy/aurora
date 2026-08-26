/**
 * SPEC-004 Phase 2 — Application error model.
 */

export type StrategicPlanErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'BRIEF_NOT_FOUND'
  | 'PLAN_ITEM_NOT_FOUND'
  | 'TRUSTED_CONTEXT_REQUIRED'
  | 'TENANT_ACCESS_DENIED'
  | 'TENANT_CONTEXT_INVALID'
  | 'ACTOR_NOT_AUTHORIZED'
  | 'BRIEF_NOT_CURRENT'
  | 'BRIEF_NOT_APPROVED'
  | 'BRIEF_REVISION_STALE'
  | 'THESIS_MISMATCH'
  | 'ACTION_NOT_AUTHORIZED'
  | 'MULTI_BRIEF_AGGREGATION_DENIED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'INVALID_PLAN'
  | 'INVALID_PLAN_ITEM'
  | 'PLAN_SUPERSEDED'
  | 'PLAN_NOT_APPROVED'
  | 'STALE_BRIEF_CONTEXT'
  | 'MATERIAL_CHANGE_REQUIRES_REVISION'
  | 'AI_APPROVAL_FORBIDDEN'
  | 'ITEM_CANNOT_SELF_AUTHORIZE'
  | 'PERSISTENCE_ERROR';

export class StrategicPlanError extends Error {
  readonly code: StrategicPlanErrorCode;

  constructor(code: StrategicPlanErrorCode, message: string) {
    super(message);
    this.name = 'StrategicPlanError';
    this.code = code;
  }
}
