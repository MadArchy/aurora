/**
 * SPEC-004 Phase 1 — Tenant envelope validators (pure).
 */

import { planFail, planOk, type PlanDomainResult } from './strategicPlanErrors';

export interface PlanTenantEnvelope {
  organizationId: string;
  clientId: string;
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assertPlanTenantStructure(
  envelope: PlanTenantEnvelope
): PlanDomainResult<PlanTenantEnvelope> {
  const organizationId = nonEmptyId(envelope.organizationId);
  const clientId = nonEmptyId(envelope.clientId);
  if (!organizationId || !clientId) {
    return planFail('INVALID_PLAN', 'organizationId and clientId are required');
  }
  return planOk({ organizationId, clientId });
}

export function planTenantEnvelopesMatch(
  left: PlanTenantEnvelope,
  right: PlanTenantEnvelope
): boolean {
  return (
    left.organizationId === right.organizationId && left.clientId === right.clientId
  );
}

/**
 * Caller supplies already-resolved tenant ids. Domain does not query repositories.
 */
export function assertPlanTenantsMatch(
  left: PlanTenantEnvelope,
  right: PlanTenantEnvelope
): PlanDomainResult<void> {
  const a = assertPlanTenantStructure(left);
  if (!a.ok) return a;
  const b = assertPlanTenantStructure(right);
  if (!b.ok) return b;
  if (!planTenantEnvelopesMatch(a.value, b.value)) {
    return planFail('TENANT_MISMATCH', 'tenant envelopes do not match');
  }
  return planOk(undefined);
}
