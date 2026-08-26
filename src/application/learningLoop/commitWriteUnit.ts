/**
 * SPEC-008 Phase 2 — Commit write unit through ports (no concrete storage).
 */

import type { LearningEvidenceRepository } from './ports/LearningEvidenceRepository';
import type { LearningHistoryPort } from './ports/LearningHistoryPort';
import type { LearningObservationRepository } from './ports/LearningObservationRepository';
import type { RecommendationDecisionRepository } from './ports/RecommendationDecisionRepository';
import type { StrategicRecommendationRepository } from './ports/StrategicRecommendationRepository';
import type { LearningWriteUnit } from './ports/LearningTenantScope';
import { mapPortFailure } from './mapDomainError';

export type LearningWritePorts = {
  observations?: LearningObservationRepository;
  evidence?: LearningEvidenceRepository;
  recommendations?: StrategicRecommendationRepository;
  history: LearningHistoryPort;
  decisions?: RecommendationDecisionRepository;
};

/**
 * Phase 2 contract: coherent write intent for aggregate + history + idempotency.
 * Phase 3 persists atomically.
 */
export function commitGovernedLearningWriteUnit(
  deps: LearningWritePorts,
  unit: LearningWriteUnit
): void {
  try {
    const hasObservations = (unit.observations?.length ?? 0) > 0;
    const hasEvidence = (unit.evidence?.length ?? 0) > 0;
    const hasRecommendations = (unit.recommendations?.length ?? 0) > 0;

    if (hasObservations && deps.observations) {
      deps.observations.commitWriteUnit(unit);
    } else if (hasObservations) {
      throw new Error('Observation repository required');
    }

    if (hasEvidence && deps.evidence) {
      deps.evidence.commitWriteUnit({
        ...unit,
        observations: undefined,
        recommendations: undefined,
      });
    } else if (hasEvidence) {
      throw new Error('Evidence repository required');
    }

    if (hasRecommendations && deps.recommendations) {
      deps.recommendations.commitWriteUnit({
        ...unit,
        observations: undefined,
        evidence: undefined,
      });
    } else if (hasRecommendations) {
      throw new Error('Recommendation repository required');
    }

    if (unit.idempotencyKeys?.length && !hasObservations && !hasEvidence && !hasRecommendations) {
      const repo = deps.observations ?? deps.evidence ?? deps.recommendations;
      if (!repo) throw new Error('Repository required for idempotency record');
      repo.commitWriteUnit(unit);
    }

    for (const entry of unit.history) {
      deps.history.append(entry);
    }

    for (const decision of unit.decisions ?? []) {
      deps.decisions?.append(decision);
    }
  } catch (err) {
    mapPortFailure(err, 'Failed to persist Learning write unit.');
  }
}
