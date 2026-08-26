/**
 * SPEC-008 Phase 4 — Read-only SPEC-007 Opportunity outcome projection.
 * Does not mutate Opportunity lifecycle (SPEC-007 remains owner).
 */

import type {
  OpportunityOutcomeProjection,
  OpportunityOutcomeReader,
} from '../../application/learningLoop/ports/OpportunityOutcomeReader';
import type { LearningTenantScope } from '../../application/learningLoop/ports/LearningTenantScope';
import type { LocalOpportunityScoutStore } from '../opportunityScout/LocalOpportunityScoutStore';
import { createLocalOpportunityScoutStore } from '../opportunityScout/LocalOpportunityScoutStore';

function mapStatusToOutcome(status: string): string {
  return status;
}

export class LocalOpportunityOutcomeReader implements OpportunityOutcomeReader {
  constructor(
    private readonly opportunityStore: LocalOpportunityScoutStore = createLocalOpportunityScoutStore()
  ) {}

  getOutcome(
    opportunityId: string,
    tenant: LearningTenantScope
  ): OpportunityOutcomeProjection | undefined {
    const opp = this.opportunityStore.getOpportunity(opportunityId, tenant);
    if (!opp) return undefined;
    return {
      opportunityId: opp.id,
      organizationId: opp.organizationId,
      clientId: opp.clientId,
      thesisId: opp.thesisId,
      outcomeStatus: mapStatusToOutcome(opp.status),
      recordedAt: opp.updatedAt,
    };
  }

  listOutcomes(tenant: LearningTenantScope): OpportunityOutcomeProjection[] {
    return this.opportunityStore
      .listOpportunities(tenant)
      .filter((o) => o.status !== 'PROPOSED')
      .map((opp) => ({
        opportunityId: opp.id,
        organizationId: opp.organizationId,
        clientId: opp.clientId,
        thesisId: opp.thesisId,
        outcomeStatus: mapStatusToOutcome(opp.status),
        recordedAt: opp.updatedAt,
      }));
  }
}
