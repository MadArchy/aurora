/**
 * SPEC-007 Phase 1 — Tenant envelope validators (pure).
 */

import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';

export interface OpportunityTenantEnvelope {
  organizationId: string;
  clientId: string;
}

export interface OpportunityTenantKeyedId extends OpportunityTenantEnvelope {
  id: string;
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assertOpportunityTenantStructure(
  envelope: OpportunityTenantEnvelope
): OpportunityDomainResult<OpportunityTenantEnvelope> {
  const organizationId = nonEmptyId(envelope.organizationId);
  const clientId = nonEmptyId(envelope.clientId);
  if (!organizationId || !clientId) {
    return oppFail('INVALID_CANDIDATE', 'organizationId and clientId are required');
  }
  return oppOk({ organizationId, clientId });
}

export function assertOpportunityTenantKeyedId(
  keyed: OpportunityTenantKeyedId
): OpportunityDomainResult<OpportunityTenantKeyedId> {
  const tenant = assertOpportunityTenantStructure(keyed);
  if (!tenant.ok) return tenant;
  const id = nonEmptyId(keyed.id);
  if (!id) {
    return oppFail('INVALID_CANDIDATE', 'id is required with tenant envelope');
  }
  return oppOk({ ...tenant.value, id });
}

export function opportunityTenantEnvelopesMatch(
  left: OpportunityTenantEnvelope,
  right: OpportunityTenantEnvelope
): boolean {
  return (
    left.organizationId === right.organizationId && left.clientId === right.clientId
  );
}

/**
 * Caller supplies already-resolved tenant ids. Domain does not query repositories.
 * Id-only authority is forbidden (F-007-04 design).
 */
export function assertOpportunityTenantsMatch(
  left: OpportunityTenantEnvelope,
  right: OpportunityTenantEnvelope
): OpportunityDomainResult<void> {
  const a = assertOpportunityTenantStructure(left);
  if (!a.ok) return a;
  const b = assertOpportunityTenantStructure(right);
  if (!b.ok) return b;
  if (!opportunityTenantEnvelopesMatch(a.value, b.value)) {
    return oppFail('TENANT_MISMATCH', 'tenant envelopes do not match');
  }
  return oppOk(undefined);
}

export function assertSameOrgClientEntity(
  aggregate: OpportunityTenantEnvelope,
  constituent: OpportunityTenantEnvelope,
  label: string
): OpportunityDomainResult<void> {
  const match = assertOpportunityTenantsMatch(aggregate, constituent);
  if (!match.ok) {
    return oppFail(
      'TENANT_MISMATCH',
      `cross-tenant ${label} reference denied`
    );
  }
  return match;
}
