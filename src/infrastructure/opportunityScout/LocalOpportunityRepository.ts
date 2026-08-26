/**
 * SPEC-007 Phase 3 — OpportunityRepository adapter (LOCAL_AUTHORITATIVE).
 * Tenant-safe: organizationId | clientId | opportunityId.
 * No id-only getById (AUDIT007-04 infrastructure contract).
 */

import type {
  OpportunityTenantScope,
  OpportunityWriteUnit,
} from '../../application/opportunityScout/ports/OpportunityCandidateRepository';
import type { OpportunityRepository } from '../../application/opportunityScout/ports/OpportunityRepository';
import type { MaterializedOpportunity } from '../../domain/opportunityCore';
import type { LocalOpportunityScoutStore } from './LocalOpportunityScoutStore';

export class LocalOpportunityRepository implements OpportunityRepository {
  constructor(private readonly store: LocalOpportunityScoutStore) {}

  getById(
    opportunityId: string,
    tenant: OpportunityTenantScope
  ): MaterializedOpportunity | undefined {
    return this.store.getOpportunity(opportunityId, tenant);
  }

  list(tenant: OpportunityTenantScope): MaterializedOpportunity[] {
    return this.store.listOpportunities(tenant);
  }

  findByIdempotencyKey(
    tenant: OpportunityTenantScope,
    key: string
  ): { opportunityId: string } | undefined {
    const hit = this.store.findByIdempotencyKey(tenant, key);
    if (!hit || hit.aggregateKind !== 'OPPORTUNITY') return undefined;
    return { opportunityId: hit.opportunityId };
  }

  commitWriteUnit(unit: OpportunityWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
