import type { VerificationStore } from '../../application/claimEvidence';
import type { ClaimVerification } from '../../domain/claimVerificationCore';
import type { LocalClaimEvidenceStore } from './LocalClaimEvidenceStore';

/** Current Verification projection. Stale records remain stored; Application gates freshness. */
export class LocalVerificationStore implements VerificationStore {
  constructor(private readonly store: LocalClaimEvidenceStore) {}

  getById(
    verificationId: string,
    tenant: { organizationId: string; clientId: string }
  ): ClaimVerification | undefined {
    return this.store.getVerificationById(verificationId, tenant);
  }

  getLatestForClaim(
    claimId: string,
    tenant: { organizationId: string; clientId: string }
  ): ClaimVerification | undefined {
    return this.store.getLatestVerificationForClaim(claimId, tenant);
  }

  findByClaimAndHash(
    claimId: string,
    tenant: { organizationId: string; clientId: string },
    contentHash: string
  ): ClaimVerification | undefined {
    return this.store.findVerificationByClaimAndHash(claimId, tenant, contentHash);
  }
}
