/**
 * SPEC-006 Phase 1 — Tenant envelope validators (pure).
 */

import { claimFail, claimOk, type ClaimDomainResult } from './claimEvidenceErrors';

export interface ClaimTenantEnvelope {
  organizationId: string;
  clientId: string;
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assertClaimTenantStructure(
  envelope: ClaimTenantEnvelope
): ClaimDomainResult<ClaimTenantEnvelope> {
  const organizationId = nonEmptyId(envelope.organizationId);
  const clientId = nonEmptyId(envelope.clientId);
  if (!organizationId || !clientId) {
    return claimFail('INVALID_CLAIM', 'organizationId and clientId are required');
  }
  return claimOk({ organizationId, clientId });
}

export function claimTenantEnvelopesMatch(
  left: ClaimTenantEnvelope,
  right: ClaimTenantEnvelope
): boolean {
  return (
    left.organizationId === right.organizationId && left.clientId === right.clientId
  );
}

/**
 * Caller supplies already-resolved tenant ids. Domain does not query repositories.
 */
export function assertTenantsMatch(
  left: ClaimTenantEnvelope,
  right: ClaimTenantEnvelope,
  code: 'TENANT_MISMATCH' | 'EVIDENCE_TENANT_MISMATCH' = 'TENANT_MISMATCH'
): ClaimDomainResult<void> {
  const a = assertClaimTenantStructure(left);
  if (!a.ok) return a;
  const b = assertClaimTenantStructure(right);
  if (!b.ok) return b;
  if (!claimTenantEnvelopesMatch(a.value, b.value)) {
    return claimFail(code, 'tenant envelopes do not match');
  }
  return claimOk(undefined);
}
