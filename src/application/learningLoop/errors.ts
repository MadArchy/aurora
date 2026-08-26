/**
 * SPEC-008 Phase 2 — Application error model.
 */

export type LearningApplicationErrorCode =
  | 'NOT_FOUND'
  | 'OBSERVATION_NOT_FOUND'
  | 'EVIDENCE_NOT_FOUND'
  | 'RECOMMENDATION_NOT_FOUND'
  | 'TRUSTED_CONTEXT_REQUIRED'
  | 'TENANT_MISMATCH'
  | 'TENANT_ACCESS_DENIED'
  | 'THESIS_MISMATCH'
  | 'UNAUTHORIZED_ACTOR'
  | 'INVALID_TRANSITION'
  | 'TERMINAL_STATE'
  | 'ACTION_NOT_AUTHORIZED'
  | 'STALE_STATE'
  | 'MALFORMED_DOMAIN_STATE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_OBSERVATION'
  | 'INVALID_EVIDENCE'
  | 'INVALID_RECOMMENDATION'
  | 'AI_AUTHORITY_FORBIDDEN'
  | 'ACTOR_FORBIDDEN'
  | 'TARGET_APPLY_DENIED'
  | 'PERSISTENCE_ERROR';

export class LearningApplicationError extends Error {
  readonly code: LearningApplicationErrorCode;

  constructor(code: LearningApplicationErrorCode, message: string) {
    super(message);
    this.name = 'LearningApplicationError';
    this.code = code;
  }
}
