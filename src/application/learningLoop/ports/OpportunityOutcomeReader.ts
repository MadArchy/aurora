/**
 * SPEC-008 Phase 2 — Read-only SPEC-007 Opportunity outcome projection.
 * SPEC-008 cannot mutate Opportunity lifecycle.
 */

import type { LearningTenantScope } from './LearningTenantScope';

export interface OpportunityOutcomeProjection {
  opportunityId: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  outcomeStatus: string;
  recordedAt: string;
}

/** Read-only ingest boundary — SPEC-007 remains owner. */
export interface OpportunityOutcomeReader {
  getOutcome(
    opportunityId: string,
    tenant: LearningTenantScope
  ): OpportunityOutcomeProjection | undefined;
  listOutcomes(tenant: LearningTenantScope): OpportunityOutcomeProjection[];
}
