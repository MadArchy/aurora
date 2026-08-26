/**
 * SPEC-007 Phase 2 — OpportunityCandidate repository port (no adapter).
 * Tenant-safe identity only — no global id-only getById.
 */

import type { OpportunityCandidate } from '../../../domain/opportunityCandidateCore';
import type { OpportunityHistoryRecord } from './OpportunityHistoryPort';

export interface OpportunityTenantScope {
  organizationId: string;
  clientId: string;
}

export interface OpportunityWriteUnit {
  candidates?: OpportunityCandidate[];
  opportunities?: import('../../../domain/opportunityCore').MaterializedOpportunity[];
  history: OpportunityHistoryRecord[];
  idempotencyKeys?: Array<{
    key: string;
    aggregateKind: 'CANDIDATE' | 'OPPORTUNITY';
    aggregateId: string;
    organizationId: string;
    clientId: string;
    at: string;
  }>;
}

export interface OpportunityCandidateRepository {
  getById(
    candidateId: string,
    tenant: OpportunityTenantScope
  ): OpportunityCandidate | undefined;
  list(tenant: OpportunityTenantScope): OpportunityCandidate[];
  findByIdempotencyKey(
    tenant: OpportunityTenantScope,
    key: string
  ): { candidateId: string } | undefined;
  commitWriteUnit(unit: OpportunityWriteUnit): void;
}
