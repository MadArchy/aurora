/**
 * SPEC-007 Phase 1 — Opportunity Scout Domain error model (pure).
 */

export type OpportunityDomainErrorCode =
  | 'INVALID_CANDIDATE'
  | 'INVALID_SCORE'
  | 'INVALID_OPPORTUNITY'
  | 'INVALID_TRANSITION'
  | 'TERMINAL_STATE'
  | 'TENANT_MISMATCH'
  | 'THESIS_MISMATCH'
  | 'CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED'
  | 'ACTION_NOT_AUTHORIZED'
  | 'SCORE_INPUT_INVALID'
  | 'UNKNOWN_SCORE_MODEL'
  | 'ACTOR_FORBIDDEN'
  | 'TRUSTED_CONTEXT_REQUIRED'
  | 'LEGACY_MAPPING_AMBIGUOUS'
  | 'MATERIAL_CHANGE_REQUIRES_REVISION'
  | 'DUPLICATE_THESIS_EVALUATION'
  | 'AI_AUTHORITY_FORBIDDEN';

export class OpportunityDomainError extends Error {
  readonly code: OpportunityDomainErrorCode;

  constructor(code: OpportunityDomainErrorCode, message: string) {
    super(message);
    this.name = 'OpportunityDomainError';
    this.code = code;
  }
}

export type OpportunityDomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OpportunityDomainError };

export function oppOk<T>(value: T): OpportunityDomainResult<T> {
  return { ok: true, value };
}

export function oppFail(
  code: OpportunityDomainErrorCode,
  message: string
): OpportunityDomainResult<never> {
  return { ok: false, error: new OpportunityDomainError(code, message) };
}
