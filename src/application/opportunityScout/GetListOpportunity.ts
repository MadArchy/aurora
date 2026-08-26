/**
 * SPEC-007 Phase 2 — GetOpportunity / ListOpportunities (tenant-safe).
 */

import type { MaterializedOpportunity } from '../../domain/opportunityCore';
import type { OpportunityCandidate } from '../../domain/opportunityCandidateCore';
import { OpportunityApplicationError } from './errors';
import { loadAuthoritativeCandidate, loadAuthoritativeOpportunity } from './loadAggregates';
import type { OpportunityCandidateRepository } from './ports/OpportunityCandidateRepository';
import type { OpportunityRepository } from './ports/OpportunityRepository';
import {
  assertNoTenantSpoof,
  assertTrustedOpportunityActor,
  ignoreCallerActorClaims,
  trustedTenant,
  type TrustedOpportunityActorContext,
} from './trustedContext';

export interface GetOpportunityInput {
  trusted: TrustedOpportunityActorContext;
  opportunityId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedOpportunity?: unknown;
  actorType?: string;
  role?: string;
}

export interface ListOpportunitiesInput {
  trusted: TrustedOpportunityActorContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  actorType?: string;
  role?: string;
}

export function createGetOpportunity(deps: { opportunities: OpportunityRepository }) {
  return function getOpportunity(input: GetOpportunityInput): MaterializedOpportunity {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedOpportunity;
    return loadAuthoritativeOpportunity(
      deps.opportunities,
      input.trusted,
      input.opportunityId
    );
  };
}

export function createListOpportunities(deps: { opportunities: OpportunityRepository }) {
  return function listOpportunities(
    input: ListOpportunitiesInput
  ): MaterializedOpportunity[] {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    return deps.opportunities.list(trustedTenant(input.trusted));
  };
}

export interface GetCandidateInput {
  trusted: TrustedOpportunityActorContext;
  candidateId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedCandidate?: unknown;
  actorType?: string;
  role?: string;
}

export function createGetOpportunityCandidate(deps: {
  candidates: OpportunityCandidateRepository;
}) {
  return function getOpportunityCandidate(input: GetCandidateInput): OpportunityCandidate {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedCandidate;
    return loadAuthoritativeCandidate(deps.candidates, input.trusted, input.candidateId);
  };
}

export function createListOpportunityCandidates(deps: {
  candidates: OpportunityCandidateRepository;
}) {
  return function listOpportunityCandidates(
    input: ListOpportunitiesInput
  ): OpportunityCandidate[] {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    return deps.candidates.list(trustedTenant(input.trusted));
  };
}

/** Explicit: history must never reconstruct current authority. */
export function denyHistoryAsCurrentAuthority(): never {
  throw new OpportunityApplicationError(
    'MALFORMED_DOMAIN_STATE',
    'History is AUDIT_ONLY and cannot establish current Opportunity authority.'
  );
}
