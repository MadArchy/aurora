/**
 * SPEC-008 Phase 1 — Learning Loop Domain error model (pure).
 */

export type LearningDomainErrorCode =
  | 'INVALID_TENANT'
  | 'INVALID_THESIS_SCOPE'
  | 'MALFORMED_OBSERVATION'
  | 'MALFORMED_EVIDENCE'
  | 'MALFORMED_RECOMMENDATION'
  | 'INVALID_TRANSITION'
  | 'TERMINAL_STATE'
  | 'TENANT_MISMATCH'
  | 'TARGET_MISMATCH'
  | 'HUMAN_APPROVAL_REQUIRED'
  | 'RECOMMENDATION_NOT_APPROVED'
  | 'SUPERSEDED_RECOMMENDATION'
  | 'INVALID_VERSION'
  | 'MATERIAL_CHANGE_REQUIRES_REVISION'
  | 'ACTOR_FORBIDDEN'
  | 'AI_AUTHORITY_FORBIDDEN'
  | 'AUTO_MUTATION_FORBIDDEN'
  | 'CONFIDENCE_NOT_AUTHORITY'
  | 'APPLY_BEFORE_APPROVAL'
  | 'OBSERVATION_SUPERSEDED';

export class LearningDomainError extends Error {
  readonly code: LearningDomainErrorCode;

  constructor(code: LearningDomainErrorCode, message: string) {
    super(message);
    this.name = 'LearningDomainError';
    this.code = code;
  }
}

export type LearningDomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: LearningDomainError };

export function lrnOk<T>(value: T): LearningDomainResult<T> {
  return { ok: true, value };
}

export function lrnFail(
  code: LearningDomainErrorCode,
  message: string
): LearningDomainResult<never> {
  return { ok: false, error: new LearningDomainError(code, message) };
}
