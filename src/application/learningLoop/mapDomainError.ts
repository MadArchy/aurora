/**
 * SPEC-008 Phase 2 — Map Domain errors → Application errors.
 */

import {
  LearningDomainError,
  type LearningDomainErrorCode,
} from '../../domain/learningLoopErrors';
import {
  LearningApplicationError,
  type LearningApplicationErrorCode,
} from './errors';

const DOMAIN_TO_APPLICATION: Record<
  LearningDomainErrorCode,
  LearningApplicationErrorCode
> = {
  INVALID_TENANT: 'TENANT_MISMATCH',
  INVALID_THESIS_SCOPE: 'THESIS_MISMATCH',
  MALFORMED_OBSERVATION: 'INVALID_OBSERVATION',
  MALFORMED_EVIDENCE: 'INVALID_EVIDENCE',
  MALFORMED_RECOMMENDATION: 'INVALID_RECOMMENDATION',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  TERMINAL_STATE: 'TERMINAL_STATE',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  TARGET_MISMATCH: 'TARGET_APPLY_DENIED',
  HUMAN_APPROVAL_REQUIRED: 'UNAUTHORIZED_ACTOR',
  RECOMMENDATION_NOT_APPROVED: 'ACTION_NOT_AUTHORIZED',
  SUPERSEDED_RECOMMENDATION: 'INVALID_TRANSITION',
  INVALID_VERSION: 'STALE_STATE',
  MATERIAL_CHANGE_REQUIRES_REVISION: 'STALE_STATE',
  ACTOR_FORBIDDEN: 'UNAUTHORIZED_ACTOR',
  AI_AUTHORITY_FORBIDDEN: 'AI_AUTHORITY_FORBIDDEN',
  AUTO_MUTATION_FORBIDDEN: 'ACTION_NOT_AUTHORIZED',
  CONFIDENCE_NOT_AUTHORITY: 'ACTION_NOT_AUTHORIZED',
  APPLY_BEFORE_APPROVAL: 'ACTION_NOT_AUTHORIZED',
  OBSERVATION_SUPERSEDED: 'INVALID_OBSERVATION',
};

export function mapDomainError(error: LearningDomainError): LearningApplicationError {
  const code = DOMAIN_TO_APPLICATION[error.code] ?? 'MALFORMED_DOMAIN_STATE';
  return new LearningApplicationError(code, error.message);
}

export function unwrapDomain<T>(
  result: { ok: true; value: T } | { ok: false; error: LearningDomainError }
): T {
  if (!result.ok) {
    throw mapDomainError(result.error);
  }
  return result.value;
}

export function mapPortFailure(err: unknown, fallback: string): never {
  if (err instanceof LearningApplicationError) throw err;
  throw new LearningApplicationError('PERSISTENCE_ERROR', fallback);
}
