import {
  StrategicPlanDomainError,
  type StrategicPlanDomainErrorCode,
} from '../../domain/strategicPlanErrors';
import { StrategicPlanError, type StrategicPlanErrorCode } from './errors';

const DOMAIN_TO_APPLICATION: Record<StrategicPlanDomainErrorCode, StrategicPlanErrorCode> = {
  INVALID_PLAN: 'INVALID_PLAN',
  INVALID_PLAN_ITEM: 'INVALID_PLAN_ITEM',
  INVALID_PLAN_TRANSITION: 'INVALID_TRANSITION',
  INVALID_ITEM_TRANSITION: 'INVALID_TRANSITION',
  TENANT_MISMATCH: 'TENANT_ACCESS_DENIED',
  BRIEF_SCOPE_MISMATCH: 'BRIEF_NOT_CURRENT',
  THESIS_MISMATCH: 'THESIS_MISMATCH',
  ACTION_NOT_AUTHORIZED: 'ACTION_NOT_AUTHORIZED',
  PLAN_SUPERSEDED: 'PLAN_SUPERSEDED',
  PLAN_NOT_APPROVED: 'PLAN_NOT_APPROVED',
  STALE_BRIEF_CONTEXT: 'STALE_BRIEF_CONTEXT',
  MATERIAL_CHANGE_REQUIRES_REVISION: 'MATERIAL_CHANGE_REQUIRES_REVISION',
  AI_APPROVAL_FORBIDDEN: 'AI_APPROVAL_FORBIDDEN',
  MULTI_BRIEF_AGGREGATION_DENIED: 'MULTI_BRIEF_AGGREGATION_DENIED',
  ITEM_CANNOT_SELF_AUTHORIZE: 'ITEM_CANNOT_SELF_AUTHORIZE',
};

export function mapDomainError(error: StrategicPlanDomainError): StrategicPlanError {
  const code = DOMAIN_TO_APPLICATION[error.code] ?? 'INVALID_PLAN';
  return new StrategicPlanError(code, error.message);
}

export function unwrapDomain<T>(
  result: { ok: true; value: T } | { ok: false; error: StrategicPlanDomainError }
): T {
  if (!result.ok) {
    throw mapDomainError(result.error);
  }
  return result.value;
}

export function mapPortFailure(err: unknown, fallback: string): never {
  if (err instanceof StrategicPlanError) throw err;
  throw new StrategicPlanError('PERSISTENCE_ERROR', fallback);
}
