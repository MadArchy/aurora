/**
 * SPEC-008 Phase 3 — Append-only RecommendationDecision adapter (AUDIT_ONLY).
 */

import type { RecommendationDecisionRepository } from '../../application/learningLoop/ports/RecommendationDecisionRepository';
import type { RecommendationDecision } from '../../domain/recommendationDecisionCore';
import type { LocalLearningLoopStore } from './LocalLearningLoopStore';

export class LocalRecommendationDecisionAdapter implements RecommendationDecisionRepository {
  constructor(private readonly store: LocalLearningLoopStore) {}

  append(decision: RecommendationDecision): void {
    this.store.appendDecision(decision);
  }

  listByRecommendation(
    recommendationId: string,
    tenant: { organizationId: string; clientId: string }
  ): RecommendationDecision[] {
    return this.store
      .listDecisions()
      .filter(
        (d) =>
          d.recommendationId === recommendationId &&
          d.organizationId === tenant.organizationId &&
          d.clientId === tenant.clientId
      );
  }

  /** Inspection only — not current authority. */
  listForInspection(): RecommendationDecision[] {
    return this.store.listDecisions();
  }
}
