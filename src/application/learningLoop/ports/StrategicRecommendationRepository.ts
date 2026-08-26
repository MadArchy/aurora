/**
 * SPEC-008 Phase 2 — StrategicRecommendation repository port (no adapter).
 */

import type { StrategicRecommendation } from '../../../domain/strategicRecommendationCore';
import type { RecommendationStatus } from '../../../domain/recommendationLifecycleCore';
import type { LearningTenantScope, LearningWriteUnit } from './LearningTenantScope';

export interface StrategicRecommendationListFilter {
  status?: RecommendationStatus;
  thesisId?: string;
}

export interface StrategicRecommendationRepository {
  getById(
    recommendationId: string,
    tenant: LearningTenantScope
  ): StrategicRecommendation | undefined;
  list(
    tenant: LearningTenantScope,
    filter?: StrategicRecommendationListFilter
  ): StrategicRecommendation[];
  findByIdempotencyKey(
    tenant: LearningTenantScope,
    key: string
  ): { recommendationId: string; materialFingerprint: string } | undefined;
  commitWriteUnit(unit: LearningWriteUnit): void;
}
