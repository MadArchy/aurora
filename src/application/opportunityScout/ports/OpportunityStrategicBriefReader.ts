/**
 * SPEC-007 Phase 2 — Read-only Strategic Brief projection (SPEC-003).
 * Application cannot approve/revise Brief.
 */

import type { OpportunityTenantScope } from './OpportunityCandidateRepository';

export interface OpportunityBriefProjection {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  version: number;
  status: string;
}

export interface OpportunityStrategicBriefReader {
  getById(
    briefId: string,
    tenant: OpportunityTenantScope
  ): OpportunityBriefProjection | undefined;
}
