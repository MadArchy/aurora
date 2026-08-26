/**
 * SPEC-008 Phase 3 — StrategicRecommendationRepository adapter (LOCAL_AUTHORITATIVE).
 */

import type { StrategicRecommendationRepository } from '../../application/learningLoop/ports/StrategicRecommendationRepository';
import type {
  LearningTenantScope,
  LearningWriteUnit,
} from '../../application/learningLoop/ports/LearningTenantScope';
import type { StrategicRecommendation } from '../../domain/strategicRecommendationCore';
import type { StrategicRecommendationListFilter } from '../../application/learningLoop/ports/StrategicRecommendationRepository';
import type { LocalLearningLoopStore } from './LocalLearningLoopStore';

export class LocalStrategicRecommendationRepository
  implements StrategicRecommendationRepository
{
  constructor(private readonly store: LocalLearningLoopStore) {}

  getById(
    recommendationId: string,
    tenant: LearningTenantScope
  ): StrategicRecommendation | undefined {
    return this.store.getRecommendation(recommendationId, tenant);
  }

  list(
    tenant: LearningTenantScope,
    filter?: StrategicRecommendationListFilter
  ): StrategicRecommendation[] {
    return this.store
      .listRecommendations(tenant)
      .filter((r) => (filter?.status ? r.status === filter.status : true))
      .filter((r) =>
        filter?.thesisId && r.thesisScope.kind === 'SINGLE'
          ? r.thesisScope.thesisId === filter.thesisId
          : true
      );
  }

  findByIdempotencyKey(
    tenant: LearningTenantScope,
    key: string
  ): { recommendationId: string; materialFingerprint: string } | undefined {
    const hit = this.store.findByIdempotencyKey(tenant, key);
    if (!hit || hit.aggregateKind !== 'RECOMMENDATION') return undefined;
    return {
      recommendationId: hit.recommendationId,
      materialFingerprint: hit.materialFingerprint,
    };
  }

  commitWriteUnit(unit: LearningWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
