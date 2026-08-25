import {
  markEvidenceRequired,
  markResearchRequired,
  type Claim,
} from '../../domain/claimCore';
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

export interface RequireEvidenceInput {
  trusted: TrustedClaimActorContext;
  claimId: string;
  mode: 'EVIDENCE_REQUIRED' | 'RESEARCH_REQUIRED';
  claimedOrganizationId?: string;
  claimedClientId?: string;
  persist?: boolean;
}

export interface RequireEvidenceResult {
  claim: Claim;
  writeUnitCommitted: boolean;
}

export interface RequireEvidenceDeps {
  claims: ClaimRepository;
  history: ClaimHistoryPort;
}

export function createRequireEvidence(deps: RequireEvidenceDeps) {
  return function requireEvidence(input: RequireEvidenceInput): RequireEvidenceResult {
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

    if (claim.status === input.mode) {
      return { claim, writeUnitCommitted: false };
    }

    const next =
      input.mode === 'EVIDENCE_REQUIRED'
        ? unwrapDomain(markEvidenceRequired(claim, input.trusted.now))
        : unwrapDomain(markResearchRequired(claim, input.trusted.now));

    const history = {
      id: `hist_${claim.id}_${input.mode}`,
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      claimId: claim.id,
      event:
        input.mode === 'EVIDENCE_REQUIRED'
          ? ('EVIDENCE_REQUIRED' as const)
          : ('RESEARCH_REQUIRED' as const),
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
