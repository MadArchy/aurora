import type { ClaimEvidence } from '../../../domain/evidenceCore';
import type { ClaimEvidenceLink } from '../../../domain/claimLinkCore';
import type { ClaimTenantScope } from './ClaimRepository';

/**
 * Evidence read + link lookup. Writes of Evidence entities are Phase 3 vault adapter.
 * ClaimEvidenceLink mutations go through ClaimRepository.write unit.
 */
export interface EvidenceReader {
  getById(evidenceId: string, tenant: ClaimTenantScope): ClaimEvidence | undefined;
  findLink(
    tenant: ClaimTenantScope,
    claimId: string,
    evidenceId: string
  ): ClaimEvidenceLink | undefined;
  listLinksForClaim(tenant: ClaimTenantScope, claimId: string): ClaimEvidenceLink[];
}
