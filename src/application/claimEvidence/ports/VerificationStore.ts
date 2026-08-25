import type { ClaimVerification } from '../../../domain/claimVerificationCore';
import type { ClaimTenantScope } from './ClaimRepository';

export interface VerificationStore {
  getById(verificationId: string, tenant: ClaimTenantScope): ClaimVerification | undefined;
  /** Latest verification for claim; Application validates contentHash freshness. */
  getLatestForClaim(claimId: string, tenant: ClaimTenantScope): ClaimVerification | undefined;
  findByClaimAndHash(
    claimId: string,
    tenant: ClaimTenantScope,
    contentHash: string
  ): ClaimVerification | undefined;
}
