import type { Claim } from '../../domain/claimCore';
import {
  evaluateClaimPublicationEligibility,
  type ClaimPublicationDecision,
} from '../../domain/claimGateCore';
import {
  buildClaimExplainabilityProjection,
  type ClaimExplainabilityProjection,
} from '../../domain/claimMaterialityCore';
import { ClaimEvidenceError } from './errors';
import { unwrapDomain } from './mapDomainError';
import type { ClaimContentReader } from './ports/ClaimContentReader';
import type { ClaimRepository } from './ports/ClaimRepository';
import type { EvidenceReader } from './ports/EvidenceReader';
import type { VerificationStore } from './ports/VerificationStore';
import {
  assertNoTenantSpoof,
  assertTrustedClaimActor,
  type TrustedClaimActorContext,
} from './trustedContext';

export interface AuthorizePublicationInput {
  trusted: TrustedClaimActorContext;
  contentId: string;
  targetContentStatus: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /**
   * Caller-forged claim snapshots are IGNORED.
   * Application loads governed current Claims from repository.
   */
  forgedClaims?: unknown;
}

export interface AuthorizePublicationResult {
  decision: ClaimPublicationDecision;
  claims: Claim[];
  explainability: ClaimExplainabilityProjection[];
}

export interface AuthorizePublicationDeps {
  claims: ClaimRepository;
  content: ClaimContentReader;
  evidence: EvidenceReader;
  verifications: VerificationStore;
}

/**
 * Query/decision only — does not write published status or mutate Content.
 */
export function createAuthorizePublication(deps: AuthorizePublicationDeps) {
  return function authorizePublication(
    input: AuthorizePublicationInput
  ): AuthorizePublicationResult {
    assertTrustedClaimActor(input.trusted);
    assertNoTenantSpoof(input);

    // Explicitly discard forged caller snapshots.
    void input.forgedClaims;

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const contentCtx = deps.content.getById(input.contentId, tenant);
    if (!contentCtx) {
      throw new ClaimEvidenceError(
        'CONTENT_NOT_FOUND',
        `Content not found in tenant: ${input.contentId}`
      );
    }

    // Complete governed claim set — no claims[0] / majority / caller subset.
    const claims = deps.claims.findByContent(tenant, contentCtx.contentId);

    // Drop claims whose contentHash is stale vs current content (material change).
    const currentClaims = claims.filter((c) => c.contentHash === contentCtx.contentHash);

    const decision = unwrapDomain(
      evaluateClaimPublicationEligibility({
        claims: currentClaims,
        targetContentStatus: input.targetContentStatus,
      })
    );

    const explainability = currentClaims.map((claim) => {
      const links = deps.evidence.listLinksForClaim(tenant, claim.id);
      const verification = deps.verifications.findByClaimAndHash(
        claim.id,
        tenant,
        claim.contentHash
      );
      // Stale verification (hash mismatch) is not authoritative.
      const freshVerification =
        verification && verification.contentHash === claim.contentHash
          ? verification
          : undefined;

      return buildClaimExplainabilityProjection({
        claim,
        evidenceIds: links.map((l) => l.evidenceId),
        verification: freshVerification,
        gateResult: decision.result,
        gateReasonCode: decision.reasonCode,
        overrideApplied: claim.status === 'OVERRIDDEN',
      });
    });

    return {
      decision,
      claims: currentClaims,
      explainability,
    };
  };
}
