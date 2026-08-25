import { ClaimEvidenceDomainError } from '../../domain/claimEvidenceErrors';
import { ClaimEvidenceError, type ClaimEvidenceErrorCode } from './errors';

const DOMAIN_TO_APPLICATION: Record<string, ClaimEvidenceErrorCode> = {
  INVALID_CLAIM: 'INVALID_CLAIM',
  INVALID_EVIDENCE: 'EVIDENCE_NOT_FOUND',
  INVALID_SOURCE: 'INVALID_CLAIM',
  INVALID_VERIFICATION: 'VERIFICATION_FORBIDDEN',
  INVALID_LINK: 'INVALID_LINK',
  INVALID_STATE_TRANSITION: 'INVALID_TRANSITION',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  EVIDENCE_TENANT_MISMATCH: 'EVIDENCE_TENANT_MISMATCH',
  VERIFICATION_FORBIDDEN: 'VERIFICATION_FORBIDDEN',
  AI_VERIFICATION_FORBIDDEN: 'AI_VERIFICATION_FORBIDDEN',
  OVERRIDE_INVALID: 'OVERRIDE_INVALID',
  HARD_BLOCK_NON_OVERRIDABLE: 'HARD_BLOCK_NON_OVERRIDABLE',
  PUBLICATION_BLOCKED: 'PUBLICATION_BLOCKED',
};

export function mapDomainError(error: ClaimEvidenceDomainError): ClaimEvidenceError {
  const code = DOMAIN_TO_APPLICATION[error.code] ?? 'INVALID_CLAIM';
  return new ClaimEvidenceError(code, error.message);
}

export function unwrapDomain<T>(
  result: { ok: true; value: T } | { ok: false; error: ClaimEvidenceDomainError }
): T {
  if (!result.ok) {
    throw mapDomainError(result.error);
  }
  return result.value;
}

export function mapPortFailure(err: unknown, fallback: string): never {
  if (err instanceof ClaimEvidenceError) throw err;
  throw new ClaimEvidenceError('PERSISTENCE_ERROR', fallback);
}
