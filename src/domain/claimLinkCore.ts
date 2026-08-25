/**
 * SPEC-006 Phase 1 — ClaimEvidenceLink association invariants.
 * Links are intentional — never inferred from URL/text similarity/array order.
 */

import { claimFail, claimOk, type ClaimDomainResult } from './claimEvidenceErrors';
import type { ClaimEvidence } from './evidenceCore';
import {
  assertTenantsMatch,
  claimTenantEnvelopesMatch,
  type ClaimTenantEnvelope,
} from './claimTenantCore';

export interface ClaimEvidenceLink {
  id: string;
  organizationId: string;
  clientId: string;
  claimId: string;
  evidenceId: string;
  createdAt: string;
  createdBy: string;
  note?: string;
}

export interface ClaimRefForLink {
  id: string;
  organizationId: string;
  clientId: string;
}

export interface CreateClaimEvidenceLinkInput {
  id: string;
  claim: ClaimRefForLink;
  evidence: ClaimEvidence | ClaimRefForLink;
  createdAt: string;
  createdBy: string;
  note?: string;
}

function nonEmpty(value: unknown, field: string): ClaimDomainResult<string> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return claimFail('INVALID_LINK', `${field} is required`);
  }
  return claimOk(value.trim());
}

/**
 * Same-tenant Claim↔Evidence link. Cross-tenant = DENIED.
 * Same Evidence may link to multiple Claims when tenants match (reuse).
 */
export function createClaimEvidenceLink(
  input: CreateClaimEvidenceLinkInput
): ClaimDomainResult<ClaimEvidenceLink> {
  const id = nonEmpty(input.id, 'id');
  if (!id.ok) return id;
  const claimId = nonEmpty(input.claim.id, 'claimId');
  if (!claimId.ok) return claimId;
  const evidenceId = nonEmpty(
    'id' in input.evidence ? input.evidence.id : '',
    'evidenceId'
  );
  if (!evidenceId.ok) return evidenceId;
  const createdAt = nonEmpty(input.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;
  const createdBy = nonEmpty(input.createdBy, 'createdBy');
  if (!createdBy.ok) return createdBy;

  const claimTenant: ClaimTenantEnvelope = {
    organizationId: input.claim.organizationId,
    clientId: input.claim.clientId,
  };
  const evidenceTenant: ClaimTenantEnvelope = {
    organizationId: input.evidence.organizationId,
    clientId: input.evidence.clientId,
  };

  const match = assertTenantsMatch(
    claimTenant,
    evidenceTenant,
    'EVIDENCE_TENANT_MISMATCH'
  );
  if (!match.ok) return match;

  const note =
    typeof input.note === 'string' && input.note.trim().length > 0
      ? input.note.trim()
      : undefined;

  return claimOk({
    id: id.value,
    organizationId: claimTenant.organizationId.trim(),
    clientId: claimTenant.clientId.trim(),
    claimId: claimId.value,
    evidenceId: evidenceId.value,
    createdAt: createdAt.value,
    createdBy: createdBy.value,
    note,
  });
}

/** Same-tenant reuse: Evidence E may support Claim C1 and C2. */
export function assertEvidenceReusableForClaim(
  evidence: ClaimTenantEnvelope,
  claim: ClaimTenantEnvelope
): ClaimDomainResult<void> {
  if (!claimTenantEnvelopesMatch(evidence, claim)) {
    return claimFail(
      'EVIDENCE_TENANT_MISMATCH',
      'cross-tenant evidence reuse is forbidden'
    );
  }
  return claimOk(undefined);
}
