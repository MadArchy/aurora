/**
 * SPEC-007 Phase 3 — OpportunityCandidateRepository adapter (LOCAL_AUTHORITATIVE).
 * No id-only getById.
 */

import type {
  OpportunityCandidateRepository,
  OpportunityTenantScope,
  OpportunityWriteUnit,
} from '../../application/opportunityScout/ports/OpportunityCandidateRepository';
import type { OpportunityCandidate } from '../../domain/opportunityCandidateCore';
import type { LocalOpportunityScoutStore } from './LocalOpportunityScoutStore';

export class LocalOpportunityCandidateRepository
  implements OpportunityCandidateRepository
{
  constructor(private readonly store: LocalOpportunityScoutStore) {}

  getById(
    candidateId: string,
    tenant: OpportunityTenantScope
  ): OpportunityCandidate | undefined {
    return this.store.getCandidate(candidateId, tenant);
  }

  list(tenant: OpportunityTenantScope): OpportunityCandidate[] {
    return this.store.listCandidates(tenant);
  }

  findByIdempotencyKey(
    tenant: OpportunityTenantScope,
    key: string
  ): { candidateId: string } | undefined {
    const hit = this.store.findByIdempotencyKey(tenant, key);
    if (!hit || hit.aggregateKind !== 'CANDIDATE') return undefined;
    return { candidateId: hit.candidateId };
  }

  commitWriteUnit(unit: OpportunityWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
