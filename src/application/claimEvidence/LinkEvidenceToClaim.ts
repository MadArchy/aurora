import { markClaimLinked, type Claim } from '../../domain/claimCore';
import { createClaimEvidenceLink, type ClaimEvidenceLink } from '../../domain/claimLinkCore';
import { commitClaimWriteUnit } from './commitWriteUnit';
import { ClaimEvidenceError } from './errors';
import { unwrapDomain } from './mapDomainError';
import type { ClaimHistoryPort } from './ports/ClaimHistoryPort';
import type { ClaimRepository } from './ports/ClaimRepository';
import type { EvidenceReader } from './ports/EvidenceReader';
import {
  assertNoTenantSpoof,
  assertTrustedClaimActor,
  type TrustedClaimActorContext,
} from './trustedContext';

export interface LinkEvidenceToClaimInput {
  trusted: TrustedClaimActorContext;
  claimId: string;
  evidenceId: string;
  linkId: string;
  note?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  persist?: boolean;
}

export interface LinkEvidenceToClaimResult {
  claim: Claim;
  link: ClaimEvidenceLink;
  created: boolean;
  writeUnitCommitted: boolean;
}

export interface LinkEvidenceToClaimDeps {
  claims: ClaimRepository;
  history: ClaimHistoryPort;
  evidence: EvidenceReader;
}

export function createLinkEvidenceToClaim(deps: LinkEvidenceToClaimDeps) {
  return function linkEvidenceToClaim(
    input: LinkEvidenceToClaimInput
  ): LinkEvidenceToClaimResult {
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

    const evidence = deps.evidence.getById(input.evidenceId, tenant);
    if (!evidence) {
      throw new ClaimEvidenceError(
        'EVIDENCE_NOT_FOUND',
        `Evidence not found in tenant: ${input.evidenceId}`
      );
    }

    // Foreign evidence: EvidenceReader must return undefined for other tenants;
    // Domain link still enforces envelope match.
    const existing = deps.evidence.findLink(tenant, claim.id, evidence.id);
    if (existing) {
      return {
        claim,
        link: existing,
        created: false,
        writeUnitCommitted: false,
      };
    }

    const link = unwrapDomain(
      createClaimEvidenceLink({
        id: input.linkId,
        claim,
        evidence,
        createdAt: input.trusted.now,
        createdBy: input.trusted.actorId,
        note: input.note,
      })
    );

    const nextClaim = unwrapDomain(markClaimLinked(claim, input.trusted.now));

    const history = {
      id: `hist_${link.id}`,
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      claimId: claim.id,
      event: 'EVIDENCE_LINKED' as const,
      actorId: input.trusted.actorId,
      at: input.trusted.now,
      beforeStatus: claim.status,
      afterStatus: nextClaim.status,
      evidenceIds: [evidence.id],
      contentHash: claim.contentHash,
    };

    const persist = input.persist !== false;
    if (persist) {
      commitClaimWriteUnit(deps.claims, deps.history, {
        claims: [nextClaim],
        links: [link],
        history: [history],
      });
    }

    return {
      claim: nextClaim,
      link,
      created: true,
      writeUnitCommitted: persist,
    };
  };
}
