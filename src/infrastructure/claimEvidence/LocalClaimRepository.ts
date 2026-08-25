import type { ClaimRepository, ClaimWriteUnit } from '../../application/claimEvidence';
import type { Claim } from '../../domain/claimCore';
import type { LocalClaimEvidenceStore } from './LocalClaimEvidenceStore';

/** Current Claim projection adapter. History is physically separate. */
export class LocalClaimRepository implements ClaimRepository {
  constructor(private readonly store: LocalClaimEvidenceStore) {}

  getById(claimId: string, tenant: { organizationId: string; clientId: string }): Claim | undefined {
    return this.store.getClaimById(claimId, tenant);
  }

  findByContent(tenant: { organizationId: string; clientId: string }, contentId: string): Claim[] {
    return this.store.findClaimsByContent(tenant, contentId);
  }

  findByContentHash(
    tenant: { organizationId: string; clientId: string },
    contentId: string,
    contentHash: string,
    text: string,
    kind: string
  ): Claim | undefined {
    return this.store.findClaimByContentHash(tenant, contentId, contentHash, text, kind);
  }

  commitWriteUnit(unit: ClaimWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
