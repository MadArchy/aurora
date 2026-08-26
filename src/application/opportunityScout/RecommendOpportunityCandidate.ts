/**
 * SPEC-007 Phase 2 — RecommendOpportunityCandidate (non-executing).
 */

import { transitionCandidateStatus } from '../../domain/opportunityCandidateCore';
import {
  candidateMaterialFingerprint,
  createHistoryEventIntent,
} from '../../domain/opportunityMaterialityCore';
import { projectOpportunityCandidateExplainability } from '../../domain/opportunityExplainabilityCore';
import { commitGovernedOpportunityWriteUnit } from './commitWriteUnit';
import { OpportunityApplicationError } from './errors';
import { loadAuthoritativeCandidate } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { OpportunityCandidateRepository } from './ports/OpportunityCandidateRepository';
import type { OpportunityHistoryPort } from './ports/OpportunityHistoryPort';
import {
  assertNoTenantSpoof,
  assertTrustedOpportunityActor,
  ignoreCallerActorClaims,
  resolveTrustedOpportunityActorKind,
  trustedTenant,
  type TrustedOpportunityActorContext,
} from './trustedContext';

export interface RecommendOpportunityCandidateInput {
  trusted: TrustedOpportunityActorContext;
  candidateId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedCandidate?: unknown;
  actorType?: string;
  role?: string;
  softwareAuthority?: boolean;
  persist?: boolean;
}

export function createRecommendOpportunityCandidate(deps: {
  candidates: OpportunityCandidateRepository;
  history: OpportunityHistoryPort;
}) {
  return function recommendOpportunityCandidate(input: RecommendOpportunityCandidateInput) {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedCandidate;
    resolveTrustedOpportunityActorKind(input.trusted, 'intelligence');

    const current = loadAuthoritativeCandidate(
      deps.candidates,
      input.trusted,
      input.candidateId
    );

    if (!current.latestScore) {
      throw new OpportunityApplicationError(
        'INVALID_CANDIDATE',
        'Cannot recommend candidate without OpportunityScore.'
      );
    }

    const candidate = unwrapDomain(
      transitionCandidateStatus(current, 'RECOMMENDED', input.trusted.now)
    );

    const tenant = trustedTenant(input.trusted);
    const history = createHistoryEventIntent({
      kind: 'CANDIDATE_EVALUATED',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'CANDIDATE',
      aggregateId: candidate.id,
      aggregateVersion: candidate.version,
      actorKind: 'HUMAN',
      reasonCodes: ['CANDIDATE_RECOMMENDED'],
      materialFingerprint: candidateMaterialFingerprint(candidate),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedOpportunityWriteUnit(deps, {
        candidates: [candidate],
        history: [history],
      });
      writeUnitCommitted = true;
    }

    return {
      candidate,
      writeUnitCommitted,
      explainability: projectOpportunityCandidateExplainability(candidate),
      /** Recommendation never authorizes CREATE_OPPORTUNITY. */
      executionAuthority: false as const,
    };
  };
}
