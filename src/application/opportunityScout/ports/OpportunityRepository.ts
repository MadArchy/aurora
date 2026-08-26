/**
 * SPEC-007 Phase 2 — Materialized Opportunity repository port (no adapter).
 * Tenant-safe: organizationId | clientId | opportunityId.
 * No global getById (AUDIT007-04 port-level fix).
 */

import type { MaterializedOpportunity } from '../../../domain/opportunityCore';
import type {
  OpportunityTenantScope,
  OpportunityWriteUnit,
} from './OpportunityCandidateRepository';

export interface OpportunityRepository {
  getById(
    opportunityId: string,
    tenant: OpportunityTenantScope
  ): MaterializedOpportunity | undefined;
  list(tenant: OpportunityTenantScope): MaterializedOpportunity[];
  findByIdempotencyKey(
    tenant: OpportunityTenantScope,
    key: string
  ): { opportunityId: string } | undefined;
  commitWriteUnit(unit: OpportunityWriteUnit): void;
}
