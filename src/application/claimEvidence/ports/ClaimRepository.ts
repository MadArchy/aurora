import type { Claim } from '../../../domain/claimCore';
import type { ClaimEvidenceLink } from '../../../domain/claimLinkCore';
import type { ClaimOverrideRecord } from '../../../domain/claimOverrideCore';
import type { ClaimVerification } from '../../../domain/claimVerificationCore';
import type { ClaimHistoryRecord } from './ClaimHistoryPort';

export interface ClaimTenantScope {
  organizationId: string;
  clientId: string;
}

/**
 * Required write set for a governed Claim mutation.
 * Phase 3 must persist atomically. Phase 2 does not implement storage.
 */
export interface ClaimWriteUnit {
  claims: Claim[];
  links?: ClaimEvidenceLink[];
  verifications?: ClaimVerification[];
  history: ClaimHistoryRecord[];
  overrideAudit?: ClaimOverrideRecord;
}

export interface ClaimRepository {
  getById(claimId: string, tenant: ClaimTenantScope): Claim | undefined;
  findByContent(tenant: ClaimTenantScope, contentId: string): Claim[];
  findByContentHash(
    tenant: ClaimTenantScope,
    contentId: string,
    contentHash: string,
    text: string,
    kind: string
  ): Claim | undefined;
  commitWriteUnit(unit: ClaimWriteUnit): void;
}
