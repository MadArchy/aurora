/**
 * SPEC-007 Phase 2 — Application error model.
 */

export type OpportunityApplicationErrorCode =
  | 'NOT_FOUND'
  | 'CANDIDATE_NOT_FOUND'
  | 'OPPORTUNITY_NOT_FOUND'
  | 'TRUSTED_CONTEXT_REQUIRED'
  | 'TENANT_MISMATCH'
  | 'TENANT_ACCESS_DENIED'
  | 'THESIS_MISMATCH'
  | 'UNAUTHORIZED_ACTOR'
  | 'INVALID_TRANSITION'
  | 'TERMINAL_STATE'
  | 'SPEC004_DENY'
  | 'ACTION_NOT_AUTHORIZED'
  | 'STALE_STATE'
  | 'MALFORMED_DOMAIN_STATE'
  | 'CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED'
  | 'SCORE_INPUT_INVALID'
  | 'UNKNOWN_SCORE_MODEL'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_CANDIDATE'
  | 'INVALID_OPPORTUNITY'
  | 'INVALID_SCORE'
  | 'AI_AUTHORITY_FORBIDDEN'
  | 'ACTOR_FORBIDDEN'
  | 'PERSISTENCE_ERROR';

export class OpportunityApplicationError extends Error {
  readonly code: OpportunityApplicationErrorCode;

  constructor(code: OpportunityApplicationErrorCode, message: string) {
    super(message);
    this.name = 'OpportunityApplicationError';
    this.code = code;
  }
}
