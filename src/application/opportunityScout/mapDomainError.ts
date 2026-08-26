/**
 * SPEC-007 Phase 2 — Map Domain errors → Application errors.
 */

import {
  OpportunityDomainError,
  type OpportunityDomainErrorCode,
} from '../../domain/opportunityScoutErrors';
import {
  OpportunityApplicationError,
  type OpportunityApplicationErrorCode,
} from './errors';

const DOMAIN_TO_APPLICATION: Record<
  OpportunityDomainErrorCode,
  OpportunityApplicationErrorCode
> = {
  INVALID_CANDIDATE: 'INVALID_CANDIDATE',
  INVALID_SCORE: 'INVALID_SCORE',
  INVALID_OPPORTUNITY: 'INVALID_OPPORTUNITY',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  TERMINAL_STATE: 'TERMINAL_STATE',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  THESIS_MISMATCH: 'THESIS_MISMATCH',
  CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED: 'CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED',
  ACTION_NOT_AUTHORIZED: 'ACTION_NOT_AUTHORIZED',
  SCORE_INPUT_INVALID: 'SCORE_INPUT_INVALID',
  UNKNOWN_SCORE_MODEL: 'UNKNOWN_SCORE_MODEL',
  ACTOR_FORBIDDEN: 'UNAUTHORIZED_ACTOR',
  TRUSTED_CONTEXT_REQUIRED: 'TRUSTED_CONTEXT_REQUIRED',
  LEGACY_MAPPING_AMBIGUOUS: 'MALFORMED_DOMAIN_STATE',
  MATERIAL_CHANGE_REQUIRES_REVISION: 'STALE_STATE',
  DUPLICATE_THESIS_EVALUATION: 'INVALID_CANDIDATE',
  AI_AUTHORITY_FORBIDDEN: 'AI_AUTHORITY_FORBIDDEN',
};

export function mapDomainError(error: OpportunityDomainError): OpportunityApplicationError {
  const code = DOMAIN_TO_APPLICATION[error.code] ?? 'MALFORMED_DOMAIN_STATE';
  return new OpportunityApplicationError(code, error.message);
}

export function unwrapDomain<T>(
  result: { ok: true; value: T } | { ok: false; error: OpportunityDomainError }
): T {
  if (!result.ok) {
    throw mapDomainError(result.error);
  }
  return result.value;
}

export function mapPortFailure(err: unknown, fallback: string): never {
  if (err instanceof OpportunityApplicationError) throw err;
  throw new OpportunityApplicationError('PERSISTENCE_ERROR', fallback);
}
