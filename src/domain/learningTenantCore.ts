/**
 * SPEC-008 Phase 1 — Tenant envelope validators (pure).
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';

export interface LearningTenantEnvelope {
  organizationId: string;
  clientId: string;
}

export interface LearningTenantKeyedId extends LearningTenantEnvelope {
  id: string;
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assertLearningTenantStructure(
  envelope: LearningTenantEnvelope
): LearningDomainResult<LearningTenantEnvelope> {
  const organizationId = nonEmptyId(envelope.organizationId);
  const clientId = nonEmptyId(envelope.clientId);
  if (!organizationId || !clientId) {
    return lrnFail('INVALID_TENANT', 'organizationId and clientId are required');
  }
  return lrnOk({ organizationId, clientId });
}

export function assertLearningTenantKeyedId(
  keyed: LearningTenantKeyedId
): LearningDomainResult<LearningTenantKeyedId> {
  const tenant = assertLearningTenantStructure(keyed);
  if (!tenant.ok) return tenant;
  const id = nonEmptyId(keyed.id);
  if (!id) {
    return lrnFail('INVALID_TENANT', 'id is required with tenant envelope');
  }
  return lrnOk({ ...tenant.value, id });
}

export function learningTenantEnvelopesMatch(
  left: LearningTenantEnvelope,
  right: LearningTenantEnvelope
): boolean {
  return (
    left.organizationId === right.organizationId && left.clientId === right.clientId
  );
}

export function assertLearningTenantsMatch(
  left: LearningTenantEnvelope,
  right: LearningTenantEnvelope
): LearningDomainResult<void> {
  const a = assertLearningTenantStructure(left);
  if (!a.ok) return a;
  const b = assertLearningTenantStructure(right);
  if (!b.ok) return b;
  if (!learningTenantEnvelopesMatch(a.value, b.value)) {
    return lrnFail('TENANT_MISMATCH', 'tenant envelopes do not match');
  }
  return lrnOk(undefined);
}

export function assertSameOrgClientLearningEntity(
  aggregate: LearningTenantEnvelope,
  constituent: LearningTenantEnvelope,
  label: string
): LearningDomainResult<void> {
  const match = assertLearningTenantsMatch(aggregate, constituent);
  if (!match.ok) {
    return lrnFail('TENANT_MISMATCH', `cross-tenant ${label} reference denied`);
  }
  return match;
}
