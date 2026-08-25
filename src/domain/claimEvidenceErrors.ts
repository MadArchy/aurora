/**
 * SPEC-006 Phase 1 — Domain error model (pure).
 * CLAIM-006 error codes — infrastructure details never leak here.
 */

export type ClaimEvidenceDomainErrorCode =
  | 'INVALID_CLAIM'
  | 'INVALID_EVIDENCE'
  | 'INVALID_SOURCE'
  | 'INVALID_VERIFICATION'
  | 'INVALID_LINK'
  | 'INVALID_STATE_TRANSITION'
  | 'TENANT_MISMATCH'
  | 'EVIDENCE_TENANT_MISMATCH'
  | 'VERIFICATION_FORBIDDEN'
  | 'AI_VERIFICATION_FORBIDDEN'
  | 'OVERRIDE_INVALID'
  | 'HARD_BLOCK_NON_OVERRIDABLE'
  | 'PUBLICATION_BLOCKED';

export class ClaimEvidenceDomainError extends Error {
  readonly code: ClaimEvidenceDomainErrorCode;

  constructor(code: ClaimEvidenceDomainErrorCode, message: string) {
    super(message);
    this.name = 'ClaimEvidenceDomainError';
    this.code = code;
  }
}

export type ClaimDomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ClaimEvidenceDomainError };

export function claimOk<T>(value: T): ClaimDomainResult<T> {
  return { ok: true, value };
}

export function claimFail(
  code: ClaimEvidenceDomainErrorCode,
  message: string
): ClaimDomainResult<never> {
  return { ok: false, error: new ClaimEvidenceDomainError(code, message) };
}
