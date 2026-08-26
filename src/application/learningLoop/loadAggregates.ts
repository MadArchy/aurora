/**
 * SPEC-008 Phase 2 — Load authoritative aggregates (repository wins).
 */

import type { LearningEvidence } from '../../domain/learningEvidenceCore';
import type { LearningObservation } from '../../domain/learningObservationCore';
import type { StrategicRecommendation } from '../../domain/strategicRecommendationCore';
import { LearningApplicationError } from './errors';
import type { LearningEvidenceRepository } from './ports/LearningEvidenceRepository';
import type { LearningObservationRepository } from './ports/LearningObservationRepository';
import type { StrategicRecommendationRepository } from './ports/StrategicRecommendationRepository';
import {
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';

export function loadAuthoritativeObservation(
  repo: LearningObservationRepository,
  trusted: TrustedLearningActorContext,
  observationId: string
): LearningObservation {
  const found = repo.getById(observationId, trustedTenant(trusted));
  if (!found) {
    throw new LearningApplicationError(
      'OBSERVATION_NOT_FOUND',
      `LearningObservation not found: ${observationId}`
    );
  }
  return found;
}

export function loadAuthoritativeEvidence(
  repo: LearningEvidenceRepository,
  trusted: TrustedLearningActorContext,
  evidenceId: string
): LearningEvidence {
  const found = repo.getById(evidenceId, trustedTenant(trusted));
  if (!found) {
    throw new LearningApplicationError(
      'EVIDENCE_NOT_FOUND',
      `LearningEvidence not found: ${evidenceId}`
    );
  }
  return found;
}

export function loadAuthoritativeRecommendation(
  repo: StrategicRecommendationRepository,
  trusted: TrustedLearningActorContext,
  recommendationId: string
): StrategicRecommendation {
  const found = repo.getById(recommendationId, trustedTenant(trusted));
  if (!found) {
    throw new LearningApplicationError(
      'RECOMMENDATION_NOT_FOUND',
      `StrategicRecommendation not found: ${recommendationId}`
    );
  }
  return found;
}
