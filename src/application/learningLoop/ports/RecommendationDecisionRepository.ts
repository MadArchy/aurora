/**
 * SPEC-008 Phase 2 — RecommendationDecision append-only port.
 * Decision history supports audit; current status lives on recommendation aggregate.
 */

import type { RecommendationDecision } from '../../../domain/recommendationDecisionCore';

export interface RecommendationDecisionRepository {
  append(decision: RecommendationDecision): void;
  listByRecommendation(
    recommendationId: string,
    tenant: { organizationId: string; clientId: string }
  ): RecommendationDecision[];
}
