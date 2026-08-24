import { StrategicBriefDomainError } from '../../domain/strategicBriefErrors';
import { StrategicBriefError, type StrategicBriefErrorCode } from './errors';

const DOMAIN_TO_APPLICATION: Record<string, StrategicBriefErrorCode> = {
  INVALID_BRIEF: 'BRIEF_STATE_INVALID',
  INVALID_DECISION: 'STRATEGIC_CONTEXT_INVALID',
  INVALID_STATE_TRANSITION: 'BRIEF_STATE_INVALID',
  BRIEF_NOT_ACTIONABLE: 'BRIEF_NOT_ACTIONABLE',
  ROUTING_CONTEXT_INVALID: 'ROUTING_NOT_CLEAR',
  MATERIAL_REVISION_REQUIRED: 'BRIEF_REVISION_STALE',
  OVERRIDE_INVALID: 'OVERRIDE_INVALID',
};

export function mapDomainError(error: StrategicBriefDomainError): StrategicBriefError {
  const code = DOMAIN_TO_APPLICATION[error.code] ?? 'STRATEGIC_CONTEXT_INVALID';
  return new StrategicBriefError(code, error.message);
}

export function unwrapDomain<T>(result: { ok: true; value: T } | { ok: false; error: StrategicBriefDomainError }): T {
  if (!result.ok) {
    throw mapDomainError(result.error);
  }
  return result.value;
}

export function mapPortFailure(err: unknown, fallback: string): never {
  if (err instanceof StrategicBriefError) throw err;
  throw new StrategicBriefError('PERSISTENCE_ERROR', fallback);
}
