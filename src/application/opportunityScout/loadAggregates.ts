/**
 * SPEC-007 Phase 2 — Load authoritative Candidate / Opportunity (repository wins).
 */

import type { OpportunityCandidate } from '../../domain/opportunityCandidateCore';
import type { MaterializedOpportunity } from '../../domain/opportunityCore';
import { OpportunityApplicationError } from './errors';
import type { OpportunityCandidateRepository } from './ports/OpportunityCandidateRepository';
import type { OpportunityRepository } from './ports/OpportunityRepository';
import {
  trustedTenant,
  type TrustedOpportunityActorContext,
} from './trustedContext';

export function loadAuthoritativeCandidate(
  repo: OpportunityCandidateRepository,
  trusted: TrustedOpportunityActorContext,
  candidateId: string
): OpportunityCandidate {
  const found = repo.getById(candidateId, trustedTenant(trusted));
  if (!found) {
    throw new OpportunityApplicationError(
      'CANDIDATE_NOT_FOUND',
      `OpportunityCandidate not found: ${candidateId}`
    );
  }
  return found;
}

export function loadAuthoritativeOpportunity(
  repo: OpportunityRepository,
  trusted: TrustedOpportunityActorContext,
  opportunityId: string
): MaterializedOpportunity {
  const found = repo.getById(opportunityId, trustedTenant(trusted));
  if (!found) {
    throw new OpportunityApplicationError(
      'OPPORTUNITY_NOT_FOUND',
      `Opportunity not found: ${opportunityId}`
    );
  }
  return found;
}
