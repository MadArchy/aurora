/**
 * SPEC-006 Phase 2 — Application error model.
 */

export type ClaimEvidenceErrorCode =
  | 'CLAIM_NOT_FOUND'
  | 'EVIDENCE_NOT_FOUND'
  | 'VERIFICATION_NOT_FOUND'
  | 'CONTENT_NOT_FOUND'
  | 'TENANT_MISMATCH'
  | 'EVIDENCE_TENANT_MISMATCH'
  | 'TENANT_CONTEXT_INVALID'
  | 'ACTOR_NOT_AUTHORIZED'
  | 'UNAUTHORIZED_ACTOR'
  | 'INVALID_TRANSITION'
  | 'INVALID_CLAIM'
  | 'INVALID_LINK'
  | 'VERIFICATION_FORBIDDEN'
  | 'AI_VERIFICATION_FORBIDDEN'
  | 'HARD_BLOCK'
  | 'HARD_BLOCK_NON_OVERRIDABLE'
  | 'OVERRIDE_INVALID'
  | 'STALE_VERIFICATION'
  | 'PUBLICATION_BLOCKED'
  | 'CLAIM_CONFLICT'
  | 'PERSISTENCE_ERROR';

export class ClaimEvidenceError extends Error {
  readonly code: ClaimEvidenceErrorCode;

  constructor(code: ClaimEvidenceErrorCode, message: string) {
    super(message);
    this.name = 'ClaimEvidenceError';
    this.code = code;
  }
}
