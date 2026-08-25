import { transitionClaimStatus, type Claim } from '../../domain/claimCore';
import { commitClaimWriteUnit } from './commitWriteUnit';
import { ClaimEvidenceError } from './errors';
import { unwrapDomain } from './mapDomainError';
import type { ClaimHistoryPort } from './ports/ClaimHistoryPort';
import type { ClaimRepository } from './ports/ClaimRepository';
import {
  assertNoTenantSpoof,
  assertTrustedClaimActor,
  type TrustedClaimActorContext,
} from './trustedContext';

export interface ReviewClaimInput {
  trusted: TrustedClaimActorContext;
  claimId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  persist?: boolean;
}

export interface ReviewClaimResult {
  claim: Claim;
  writeUnitCommitted: boolean;
}

export interface ReviewClaimDeps {
  claims: ClaimRepository;
  history: ClaimHistoryPort;
}

/**
 * Moves Claim to UNDER_REVIEW only. Does not verify, override, or publish.
 */
export function createReviewClaim(deps: ReviewClaimDeps) {
  return function reviewClaim(input: ReviewClaimInput): ReviewClaimResult {
    assertTrustedClaimActor(input.trusted);
    assertNoTenantSpoof(input);

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const claim = deps.claims.getById(input.claimId, tenant);
    if (!claim) {
      throw new ClaimEvidenceError('CLAIM_NOT_FOUND', `Claim not found: ${input.claimId}`);
    }

    if (claim.status === 'UNDER_REVIEW') {
      return { claim, writeUnitCommitted: false };
    }

    const next = unwrapDomain(
      transitionClaimStatus(claim, 'UNDER_REVIEW', input.trusted.now)
    );

    const history = {
      id: `hist_${claim.id}_review`,
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      claimId: claim.id,
      event: 'CLAIM_REVIEWED' as const,
      actorId: input.trusted.actorId,
      at: input.trusted.now,
      beforeStatus: claim.status,
      afterStatus: next.status,
      contentHash: claim.contentHash,
    };

    const persist = input.persist !== false;
    if (persist) {
      commitClaimWriteUnit(deps.claims, deps.history, {
        claims: [next],
        history: [history],
      });
    }

    return { claim: next, writeUnitCommitted: persist };
  };
}
